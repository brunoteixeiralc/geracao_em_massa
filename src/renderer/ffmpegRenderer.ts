import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import type { Readable } from "node:stream";
import { nanoid } from "nanoid";
import type { TemplateDefinition } from "../templates/templates.js";
import type { BatchSettings } from "../workflow/settings.js";
import { buildFfmpegArgs } from "./ffmpegPlan.js";

export type FfmpegRenderInput = {
  batchId: string;
  videoId: string;
  inputPath: string;
  template: TemplateDefinition;
  settings: BatchSettings;
};

export type FfmpegRenderResult = {
  outputPath: string;
};

export type SpawnedProcess = {
  stdout?: Readable | null;
  stderr?: Readable | null;
  once(event: "close", listener: (code: number | null) => void): unknown;
  once(event: "error", listener: (error: Error) => void): unknown;
};

export type SpawnProcess = (command: string, args: string[]) => SpawnedProcess;

export function createFfmpegRenderer(options: {
  workDir: string;
  ffmpegPath?: string;
  ffprobePath?: string;
  createOutputId?: () => string;
  probeDurationSeconds?: (inputPath: string) => Promise<number>;
  spawnProcess?: SpawnProcess;
}) {
  const ffmpegPath = options.ffmpegPath ?? "ffmpeg";
  const ffprobePath = options.ffprobePath ?? "ffprobe";
  const createOutputId = options.createOutputId ?? nanoid;
  const spawnProcess = options.spawnProcess ?? spawn;
  const probeDurationSeconds = options.probeDurationSeconds ?? ((inputPath: string) => probeWithFfprobe(spawnProcess, ffprobePath, inputPath));

  return {
    async renderVideo(input: FfmpegRenderInput): Promise<FfmpegRenderResult> {
      const outputDir = resolve(options.workDir, sanitizeSegment(input.batchId), "rendered");
      ensureInside(resolve(options.workDir), outputDir);
      await mkdir(outputDir, { recursive: true, mode: 0o700 });

      const outputPath = resolve(outputDir, `${sanitizeSegment(input.videoId)}-${sanitizeSegment(createOutputId())}.mp4`);
      ensureInside(outputDir, outputPath);
      const inputDurationSeconds = await probeDurationSeconds(input.inputPath);

      const args = buildFfmpegArgs({
        inputPath: input.inputPath,
        outputPath,
        template: input.template,
        settings: input.settings,
        inputDurationSeconds
      });

      await runFfmpeg(spawnProcess, ffmpegPath, args);

      return { outputPath };
    }
  };
}

async function runFfmpeg(spawnProcess: SpawnProcess, command: string, args: string[]) {
  const result = await runProcess(spawnProcess, command, args);

  if (result.code !== 0) {
    const message = result.stderr.trim() || "no stderr";
    throw new Error(`FFmpeg failed with code ${result.code}: ${message}`);
  }
}

async function probeWithFfprobe(spawnProcess: SpawnProcess, command: string, inputPath: string) {
  const result = await runProcess(spawnProcess, command, [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    inputPath
  ]);

  if (result.code !== 0) {
    const message = result.stderr.trim() || "no stderr";
    throw new Error(`FFprobe failed with code ${result.code}: ${message}`);
  }

  const durationSeconds = Number.parseFloat(result.stdout.trim());
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error("FFprobe returned an invalid video duration.");
  }

  return durationSeconds;
}

async function runProcess(spawnProcess: SpawnProcess, command: string, args: string[]) {
  const childProcess = spawnProcess(command, args);
  let stdout = "";
  let stderr = "";
  childProcess.stdout?.on("data", (chunk: Buffer | string) => {
    stdout += chunk.toString();
  });
  childProcess.stderr?.on("data", (chunk: Buffer | string) => {
    stderr += chunk.toString();
  });

  const code = await new Promise<number | null>((resolvePromise, reject) => {
    childProcess.once("error", reject);
    childProcess.once("close", resolvePromise);
  });

  return { code, stdout, stderr };
}

function sanitizeSegment(value: string) {
  const safeValue = value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return safeValue || "file";
}

function ensureInside(parentPath: string, childPath: string) {
  const pathFromParent = relative(parentPath, childPath);
  if (pathFromParent.startsWith("..") || pathFromParent === "" || isAbsolute(pathFromParent)) {
    throw new Error("Caminho de arquivo invalido.");
  }
}
