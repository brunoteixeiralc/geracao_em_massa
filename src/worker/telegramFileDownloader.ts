import { mkdir, open } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { nanoid } from "nanoid";

export type TelegramDownloadInput = {
  batchId: string;
  videoId: string;
  fileId: string;
  fileName: string;
};

export type TelegramDownloadResult = {
  inputPath: string;
  bytesWritten: number;
};

export type FetchLike = (url: URL) => Promise<Response>;

export function createTelegramFileDownloader(options: {
  botToken: string;
  workDir: string;
  maxInputBytes: number;
  fetch?: FetchLike;
  createFileId?: () => string;
}) {
  const fetchImpl = options.fetch ?? fetch;
  const createFileId = options.createFileId ?? nanoid;

  return {
    async downloadVideo(input: TelegramDownloadInput): Promise<TelegramDownloadResult> {
      const fileInfoUrl = new URL(`https://api.telegram.org/bot${options.botToken}/getFile`);
      fileInfoUrl.searchParams.set("file_id", input.fileId);

      const fileInfoResponse = await fetchImpl(fileInfoUrl);
      if (!fileInfoResponse.ok) {
        throw new Error("Nao foi possivel consultar o arquivo no Telegram.");
      }

      const fileInfo = await fileInfoResponse.json() as TelegramGetFileResponse;
      if (!fileInfo.ok || !fileInfo.result.file_path) {
        throw new Error("Telegram nao retornou o caminho do arquivo.");
      }

      if (typeof fileInfo.result.file_size === "number" && fileInfo.result.file_size > options.maxInputBytes) {
        throw new Error(`Arquivo maior que ${Math.round(options.maxInputBytes / 1024 / 1024)} MB.`);
      }

      const fileUrl = new URL(`https://api.telegram.org/file/bot${options.botToken}/${fileInfo.result.file_path}`);
      const fileResponse = await fetchImpl(fileUrl);
      if (!fileResponse.ok) {
        throw new Error("Nao foi possivel baixar o arquivo do Telegram.");
      }

      const bytes = Buffer.from(await fileResponse.arrayBuffer());
      if (bytes.byteLength > options.maxInputBytes) {
        throw new Error(`Arquivo maior que ${Math.round(options.maxInputBytes / 1024 / 1024)} MB.`);
      }

      const workDir = resolve(options.workDir);
      const batchDir = resolve(workDir, sanitizeSegment(input.batchId));
      ensureInside(workDir, batchDir);
      await mkdir(batchDir, { recursive: true, mode: 0o700 });

      const inputPath = resolve(batchDir, `${sanitizeSegment(input.videoId)}-${sanitizeSegment(createFileId())}.mp4`);
      ensureInside(batchDir, inputPath);
      await writePrivateFile(inputPath, bytes);

      return {
        inputPath,
        bytesWritten: bytes.byteLength
      };
    }
  };
}

type TelegramGetFileResponse = {
  ok: boolean;
  result: {
    file_path?: string;
    file_size?: number;
  };
};

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

async function writePrivateFile(filePath: string, bytes: Buffer) {
  const file = await open(filePath, "wx", 0o600);
  try {
    await file.writeFile(bytes);
  } finally {
    await file.close();
  }
}
