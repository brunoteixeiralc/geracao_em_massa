import { stat } from "node:fs/promises";
import { mkdir } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileTypeFromFile } from "file-type";
import { nanoid } from "nanoid";
import { normalizeInstagramMediaUrl } from "../bot/instagramLinks.js";

export type InstagramUrlDownloadInput = {
  batchId: string;
  videoId: string;
  sourceUrl: string;
};

export type InstagramUrlDownloadResult = {
  inputPath: string;
  bytesWritten: number;
};

export type SpawnLike = (
  command: string,
  args: string[],
  options: { stdio: ["ignore", "ignore", "pipe"] }
) => SpawnedProcess;

export type SpawnedProcess = {
  stderr: {
    on(event: "data", listener: (chunk: Buffer | string) => void): unknown;
  };
  once(event: "close", listener: (code: number | null) => void): unknown;
  once(event: "error", listener: (error: Error) => void): unknown;
  kill(signal: NodeJS.Signals): boolean;
};

export function createInstagramUrlDownloader(options: {
  workDir: string;
  maxInputBytes: number;
  ytDlpBinary?: string;
  timeoutMs?: number;
  createFileId?: () => string;
  spawnProcess?: SpawnLike;
}) {
  const ytDlpBinary = options.ytDlpBinary ?? "yt-dlp";
  const timeoutMs = options.timeoutMs ?? 120_000;
  const createFileId = options.createFileId ?? nanoid;
  const spawnProcess: SpawnLike =
    options.spawnProcess ?? ((command, args, spawnOptions) => spawn(command, args, spawnOptions) as unknown as SpawnedProcess);

  return {
    async downloadVideo(input: InstagramUrlDownloadInput): Promise<InstagramUrlDownloadResult> {
      const sourceUrl = normalizeInstagramMediaUrl(input.sourceUrl);
      if (!sourceUrl) {
        throw new Error("Link do Instagram invalido ou nao suportado.");
      }

      const workDir = resolve(options.workDir);
      const batchDir = resolve(workDir, sanitizeSegment(input.batchId));
      ensureInside(workDir, batchDir);
      await mkdir(batchDir, { recursive: true, mode: 0o700 });

      const inputPath = resolve(batchDir, `${sanitizeSegment(input.videoId)}-${sanitizeSegment(createFileId())}.mp4`);
      ensureInside(batchDir, inputPath);

      const maxMib = Math.max(1, Math.floor(options.maxInputBytes / 1024 / 1024));
      await runYtDlp(spawnProcess, ytDlpBinary, [
        "--no-playlist",
        "--no-progress",
        "--quiet",
        "--no-warnings",
        "--socket-timeout",
        "30",
        "--max-filesize",
        `${maxMib}m`,
        "--merge-output-format",
        "mp4",
        "--remux-video",
        "mp4",
        "--output",
        inputPath,
        sourceUrl
      ], timeoutMs);

      const file = await stat(inputPath);
      if (!file.isFile() || file.size === 0) {
        throw new Error("Nao foi possivel baixar o video do Instagram.");
      }

      if (file.size > options.maxInputBytes) {
        throw new Error(`Arquivo maior que ${Math.round(options.maxInputBytes / 1024 / 1024)} MB.`);
      }

      const type = await fileTypeFromFile(inputPath);
      if (type?.mime !== "video/mp4") {
        throw new Error("O link nao gerou um arquivo MP4 valido.");
      }

      return {
        inputPath,
        bytesWritten: file.size
      };
    }
  };
}

async function runYtDlp(spawnProcess: SpawnLike, command: string, args: string[], timeoutMs: number) {
  const child = spawnProcess(command, args, { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  let timedOut = false;

  child.stderr.on("data", (chunk: Buffer | string) => {
    stderr += chunk.toString();
  });

  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill("SIGTERM");
  }, timeoutMs);

  try {
    const exitCode = await new Promise<number | null>((resolvePromise, rejectPromise) => {
      child.once("error", rejectPromise);
      child.once("close", resolvePromise);
    });

    if (timedOut) {
      throw new Error("Tempo limite ao baixar o video do Instagram.");
    }

    if (exitCode !== 0) {
      throw new Error(`Falha ao baixar link do Instagram.${stderr ? ` ${stderr.trim()}` : ""}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

function sanitizeSegment(value: string) {
  const safeValue = value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return safeValue || "file";
}

function ensureInside(parentPath: string, childPath: string) {
  const pathFromParent = relative(parentPath, childPath);
  if (pathFromParent.startsWith("..") || pathFromParent === "" || pathFromParent.startsWith("/")) {
    throw new Error("Caminho de arquivo invalido.");
  }
}
