import { describe, expect, it } from "vitest";
import { createInputVideoDownloader } from "../../src/worker/inputVideoDownloader.js";

describe("input video downloader", () => {
  it("routes Telegram files and Instagram links to the correct downloader", async () => {
    const calls: string[] = [];
    const downloader = createInputVideoDownloader({
      telegramDownloader: {
        downloadVideo: async () => {
          calls.push("telegram");
          return { inputPath: "/tmp/telegram.mp4", bytesWritten: 10 };
        }
      },
      instagramDownloader: {
        downloadVideo: async () => {
          calls.push("instagram");
          return { inputPath: "/tmp/instagram.mp4", bytesWritten: 20 };
        }
      }
    });

    await downloader.downloadVideo({
      batchId: "batch-1",
      videoId: "video-1",
      sourceType: "telegram_file",
      fileId: "file-1",
      fileName: "one.mp4"
    });
    await downloader.downloadVideo({
      batchId: "batch-1",
      videoId: "video-2",
      sourceType: "instagram_url",
      sourceUrl: "https://www.instagram.com/reel/ABC123/",
      fileId: "",
      fileName: "two.mp4"
    });

    expect(calls).toEqual(["telegram", "instagram"]);
  });
});
