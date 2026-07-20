import { mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

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
}) {
  const fetchImpl = options.fetch ?? fetch;

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

      const batchDir = join(options.workDir, sanitizeSegment(input.batchId));
      await mkdir(batchDir, { recursive: true });

      const inputPath = join(batchDir, `${sanitizeSegment(input.videoId)}-${sanitizeFileName(input.fileName)}`);
      await writeFile(inputPath, bytes);

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

function sanitizeFileName(fileName: string) {
  return sanitizeSegment(basename(fileName));
}

function sanitizeSegment(value: string) {
  const safeValue = value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return safeValue || "file";
}
