import { describe, expect, it } from "vitest";
import { processQueuedBatch, type WorkerBatchStore } from "../../src/worker/processBatch.js";
import type { Batch } from "../../src/workflow/batchWorkflow.js";
import { DEFAULT_BATCH_SETTINGS } from "../../src/workflow/settings.js";

class MemoryWorkerStore implements WorkerBatchStore {
  batches: Batch[] = [];

  async findBatchById(batchId: string) {
    return structuredClone(this.batches.find((batch) => batch.id === batchId) ?? null);
  }

  async saveBatch(batch: Batch) {
    this.batches.push(structuredClone(batch));
  }
}

describe("processQueuedBatch", () => {
  it("downloads and renders queued videos before moving the batch to zipping", async () => {
    const store = new MemoryWorkerStore();
    store.batches.push({
      id: "batch-1",
      telegramUserId: "123",
      templateId: "humor-01",
      status: "queued",
      settings: DEFAULT_BATCH_SETTINGS,
      videos: [
        { id: "video-1", fileId: "file-1", fileName: "one.mp4", sizeBytes: 1000, status: "queued" },
        { id: "video-2", fileId: "file-2", fileName: "two.mp4", sizeBytes: 1000, status: "queued" }
      ]
    });
    const downloadCalls: string[] = [];
    const renderCalls: string[] = [];

    const result = await processQueuedBatch({
      batchId: "batch-1",
      store,
      downloader: {
        downloadVideo: async (input) => {
          downloadCalls.push(input.videoId);
          return { inputPath: `/tmp/${input.videoId}.mp4`, bytesWritten: 1000 };
        }
      },
      renderer: {
        renderVideo: async (input) => {
          renderCalls.push(`${input.videoId}:${input.inputPath}`);
          return { outputPath: `/tmp/rendered/${input.videoId}.mp4` };
        }
      }
    });

    expect(result.status).toBe("zipping");
    expect(result.videos.map((video) => [video.id, video.status, video.inputPath, video.outputPath])).toEqual([
      ["video-1", "ready", "/tmp/video-1.mp4", "/tmp/rendered/video-1.mp4"],
      ["video-2", "ready", "/tmp/video-2.mp4", "/tmp/rendered/video-2.mp4"]
    ]);
    expect(downloadCalls).toEqual(["video-1", "video-2"]);
    expect(renderCalls).toEqual(["video-1:/tmp/video-1.mp4", "video-2:/tmp/video-2.mp4"]);
    expect(store.batches.map((batch) => batch.status)).toEqual([
      "queued",
      "downloading",
      "downloading",
      "downloading",
      "downloading",
      "downloading",
      "validating",
      "rendering",
      "rendering",
      "rendering",
      "rendering",
      "rendering",
      "zipping"
    ]);
  });

  it("marks the batch failed when one download fails", async () => {
    const store = new MemoryWorkerStore();
    store.batches.push({
      id: "batch-1",
      telegramUserId: "123",
      templateId: "humor-01",
      status: "queued",
      settings: DEFAULT_BATCH_SETTINGS,
      videos: [{ id: "video-1", fileId: "file-1", fileName: "one.mp4", sizeBytes: 1000, status: "queued" }]
    });

    await expect(
      processQueuedBatch({
        batchId: "batch-1",
        store,
        downloader: {
          downloadVideo: async () => {
            throw new Error("download failed");
          }
        },
        renderer: {
          renderVideo: async () => {
            throw new Error("should not render");
          }
        }
      })
    ).rejects.toThrow("download failed");

    expect(store.batches.at(-1)).toMatchObject({
      status: "failed",
      videos: [{ id: "video-1", status: "failed" }]
    });
  });

  it("marks one video failed and continues rendering the rest", async () => {
    const store = new MemoryWorkerStore();
    store.batches.push({
      id: "batch-1",
      telegramUserId: "123",
      templateId: "humor-01",
      status: "queued",
      settings: DEFAULT_BATCH_SETTINGS,
      videos: [
        { id: "video-1", fileId: "file-1", fileName: "one.mp4", sizeBytes: 1000, status: "queued" },
        { id: "video-2", fileId: "file-2", fileName: "two.mp4", sizeBytes: 1000, status: "queued" }
      ]
    });

    const result = await processQueuedBatch({
      batchId: "batch-1",
      store,
      downloader: {
        downloadVideo: async (input) => ({ inputPath: `/tmp/${input.videoId}.mp4`, bytesWritten: 1000 })
      },
      renderer: {
        renderVideo: async (input) => {
          if (input.videoId === "video-1") {
            throw new Error("render failed");
          }

          return { outputPath: `/tmp/rendered/${input.videoId}.mp4` };
        }
      }
    });

    expect(result.status).toBe("zipping");
    expect(result.videos.map((video) => [video.id, video.status, video.outputPath])).toEqual([
      ["video-1", "failed", undefined],
      ["video-2", "ready", "/tmp/rendered/video-2.mp4"]
    ]);
  });
});
