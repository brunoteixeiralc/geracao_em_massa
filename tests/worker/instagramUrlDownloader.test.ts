import { EventEmitter } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { PassThrough } from "node:stream";
import { nanoid } from "nanoid";
import { describe, expect, it } from "vitest";
import { createInstagramUrlDownloader, type SpawnedProcess, type SpawnLike } from "../../src/worker/instagramUrlDownloader.js";

const minimalMp4 = Buffer.from("00000018667479706d703432000000006d70343169736f6d", "hex");

describe("Instagram URL downloader", () => {
  it("downloads a public Instagram media URL through yt-dlp into the batch work directory", async () => {
    const workDir = join(tmpdir(), `reels-instagram-${nanoid()}`);
    const spawnCalls: Array<{ command: string; args: string[] }> = [];
    const downloader = createInstagramUrlDownloader({
      workDir,
      maxInputBytes: 20 * 1024 * 1024,
      ytDlpBinary: "yt-dlp-test",
      createFileId: () => "local-123",
      spawnProcess: fakeYtDlpSpawn(spawnCalls, minimalMp4)
    });

    const result = await downloader.downloadVideo({
      batchId: "batch-1",
      videoId: "video-1",
      sourceUrl: "https://instagram.com/reel/ABC123/?utm_source=x"
    });

    expect(result.inputPath).toBe(join(workDir, "batch-1", "video-1-local-123.mp4"));
    expect(result.bytesWritten).toBe(minimalMp4.byteLength);
    expect(spawnCalls[0]?.command).toBe("yt-dlp-test");
    expect(spawnCalls[0]?.args).toContain("https://www.instagram.com/reel/ABC123/");
  });

  it("rejects unsupported URLs before calling yt-dlp", async () => {
    const spawnCalls: Array<{ command: string; args: string[] }> = [];
    const downloader = createInstagramUrlDownloader({
      workDir: join(tmpdir(), `reels-instagram-${nanoid()}`),
      maxInputBytes: 20 * 1024 * 1024,
      spawnProcess: fakeYtDlpSpawn(spawnCalls, minimalMp4)
    });

    await expect(
      downloader.downloadVideo({
        batchId: "batch-1",
        videoId: "video-1",
        sourceUrl: "https://www.instagram.com/accounts/login/"
      })
    ).rejects.toThrow("Link do Instagram invalido");
    expect(spawnCalls).toEqual([]);
  });
});

function fakeYtDlpSpawn(calls: Array<{ command: string; args: string[] }>, fileBytes: Buffer): SpawnLike {
  return (command, args) => {
    calls.push({ command, args });
    const process = new EventEmitter() as EventEmitter & {
      stderr: PassThrough;
      kill: () => boolean;
    };
    process.stderr = new PassThrough() as never;
    process.kill = () => true;

    queueMicrotask(async () => {
      const outputPath = args[args.indexOf("--output") + 1];
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, fileBytes);
      process.emit("close", 0);
    });

    return process as unknown as SpawnedProcess;
  };
}
