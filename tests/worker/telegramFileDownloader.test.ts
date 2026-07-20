import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { nanoid } from "nanoid";
import { describe, expect, it } from "vitest";
import { createTelegramFileDownloader } from "../../src/worker/telegramFileDownloader.js";

describe("createTelegramFileDownloader", () => {
  it("downloads a Telegram file into the batch work directory", async () => {
    const workDir = join(tmpdir(), `reels-download-${nanoid()}`);
    const fetchCalls: string[] = [];
    const downloader = createTelegramFileDownloader({
      botToken: "123456:test-token",
      workDir,
      maxInputBytes: 1024,
      createFileId: () => "local-123",
      fetch: async (url) => {
        fetchCalls.push(url.toString());
        if (url.toString().includes("/getFile?")) {
          return jsonResponse({ ok: true, result: { file_path: "videos/file.mp4", file_size: 11 } });
        }

        return bytesResponse("hello-video");
      }
    });

    const result = await downloader.downloadVideo({
      batchId: "batch-1",
      videoId: "video-1",
      fileId: "telegram-file-1",
      fileName: "../unsafe clip.mp4"
    });

    expect(result).toEqual({
      inputPath: join(workDir, "batch-1", "video-1-local-123.mp4"),
      bytesWritten: 11
    });
    expect(await readFile(result.inputPath, "utf8")).toBe("hello-video");
    expect(result.inputPath).not.toContain("unsafe-clip");
    expect(fetchCalls).toEqual([
      "https://api.telegram.org/bot123456:test-token/getFile?file_id=telegram-file-1",
      "https://api.telegram.org/file/bot123456:test-token/videos/file.mp4"
    ]);
  });

  it("rejects Telegram files above the configured size limit before downloading bytes", async () => {
    const downloader = createTelegramFileDownloader({
      botToken: "123456:test-token",
      workDir: join(tmpdir(), `reels-download-${nanoid()}`),
      maxInputBytes: 1024,
      fetch: async () => jsonResponse({ ok: true, result: { file_path: "videos/file.mp4", file_size: 2048 } })
    });

    await expect(
      downloader.downloadVideo({
        batchId: "batch-1",
        videoId: "video-1",
        fileId: "telegram-file-1",
        fileName: "clip.mp4"
      })
    ).rejects.toThrow("Arquivo maior que 0 MB.");
  });
});

function jsonResponse(body: unknown) {
  return {
    ok: true,
    json: async () => body
  } as Response;
}

function bytesResponse(body: string) {
  const buffer = Buffer.from(body);
  return {
    ok: true,
    arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  } as Response;
}
