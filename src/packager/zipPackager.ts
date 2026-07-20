import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { basename, isAbsolute, relative, resolve } from "node:path";
import archiver from "archiver";
import { nanoid } from "nanoid";

export type BatchZipInput = {
  batchId: string;
  videos: Array<{
    id: string;
    outputPath?: string | null;
  }>;
};

export type BatchZipResult = {
  zipPath: string;
  fileName: string;
};

export function createZipPackager(options: { workDir: string; createZipId?: () => string }) {
  const createZipId = options.createZipId ?? nanoid;

  return {
    async createBatchZip(input: BatchZipInput): Promise<BatchZipResult> {
      const workDir = resolve(options.workDir);
      const archivesDir = resolve(workDir, "archives");
      ensureInside(workDir, archivesDir);
      await mkdir(archivesDir, { recursive: true, mode: 0o700 });

      const fileName = `${sanitizeSegment(input.batchId)}.zip`;
      const zipPath = resolve(archivesDir, `${sanitizeSegment(createZipId())}.zip`);
      ensureInside(archivesDir, zipPath);

      await writeZip(zipPath, input.videos);

      return { zipPath, fileName };
    }
  };
}

async function writeZip(zipPath: string, videos: BatchZipInput["videos"]) {
  videos.forEach((video) => {
    if (!video.outputPath) {
      throw new Error(`Video ${video.id} has no rendered output path.`);
    }
  });

  await new Promise<void>((resolvePromise, reject) => {
    const output = createWriteStream(zipPath, { flags: "wx", mode: 0o600 });
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.once("close", resolvePromise);
    output.once("error", reject);
    archive.once("error", reject);

    archive.pipe(output);

    videos.forEach((video, index) => {
      const outputPath = video.outputPath as string;
      archive.file(outputPath, {
        name: `${String(index + 1).padStart(2, "0")}-${sanitizeSegment(video.id)}-${basename(outputPath)}`
      });
    });

    archive.finalize().catch(reject);
  });
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
