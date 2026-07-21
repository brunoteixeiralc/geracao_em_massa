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
  it("downloads, renders, uploads, delivers and completes queued videos", async () => {
    const store = new MemoryWorkerStore();
    store.batches.push({
      id: "batch-1",
      telegramUserId: "123",
      templateId: "humor-crocodilo",
      status: "queued",
      settings: DEFAULT_BATCH_SETTINGS,
      videos: [
        { id: "video-1", fileId: "file-1", fileName: "one.mp4", sizeBytes: 1000, status: "queued" },
        { id: "video-2", fileId: "file-2", fileName: "two.mp4", sizeBytes: 1000, status: "queued" }
      ]
    });
    const downloadCalls: string[] = [];
    const renderCalls: string[] = [];
    const uploadedKeys: string[] = [];
    const deliveredZipUrls: string[] = [];
    const notifiedStatuses: string[] = [];

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
      },
      packager: {
        createBatchZip: async (input) => {
          expect(input.videos.map((video) => video.id)).toEqual(["video-1", "video-2"]);
          return { zipPath: "/tmp/rendered/batch-1.zip", fileName: "batch-1.zip" };
        }
      },
      storage: {
        uploadFile: async (input) => {
          uploadedKeys.push(input.key);
          return { key: input.key, url: `https://files.example.com/${input.key}` };
        }
      },
      delivery: {
        deliverBatch: async (input) => {
          deliveredZipUrls.push(input.zipUrl);
        }
      },
      statusNotifier: {
        updateBatchStatus: async (batch) => {
          notifiedStatuses.push(batch.status);
        }
      }
    });

    expect(result.status).toBe("completed");
    expect(result.outputZipUrl).toBe("https://files.example.com/batches/batch-1/batch-1.zip");
    expect(result.videos.map((video) => [video.id, video.status, video.inputPath, video.outputPath, video.outputUrl])).toEqual([
      [
        "video-1",
        "delivered",
        "/tmp/video-1.mp4",
        "/tmp/rendered/video-1.mp4",
        "https://files.example.com/batches/batch-1/videos/video-1.mp4"
      ],
      [
        "video-2",
        "delivered",
        "/tmp/video-2.mp4",
        "/tmp/rendered/video-2.mp4",
        "https://files.example.com/batches/batch-1/videos/video-2.mp4"
      ]
    ]);
    expect(downloadCalls).toEqual(["video-1", "video-2"]);
    expect(renderCalls).toEqual(["video-1:/tmp/video-1.mp4", "video-2:/tmp/video-2.mp4"]);
    expect(uploadedKeys).toEqual([
      "batches/batch-1/videos/video-1.mp4",
      "batches/batch-1/videos/video-2.mp4",
      "batches/batch-1/batch-1.zip"
    ]);
    expect(deliveredZipUrls).toEqual(["https://files.example.com/batches/batch-1/batch-1.zip"]);
    expect(notifiedStatuses).toContain("downloading");
    expect(notifiedStatuses).toContain("rendering");
    expect(notifiedStatuses).toContain("zipping");
    expect(notifiedStatuses).toContain("uploading");
    expect(notifiedStatuses).toContain("delivering");
    expect(notifiedStatuses.at(-1)).toBe("completed");
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
      "zipping",
      "uploading",
      "uploading",
      "uploading",
      "delivering",
      "completed"
    ]);
  });

  it("marks the batch failed when one download fails", async () => {
    const store = new MemoryWorkerStore();
    store.batches.push({
      id: "batch-1",
      telegramUserId: "123",
      templateId: "humor-crocodilo",
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
        },
        packager: {
          createBatchZip: async () => {
            throw new Error("should not package");
          }
        },
        storage: {
          uploadFile: async () => {
            throw new Error("should not upload");
          }
        },
        delivery: {
          deliverBatch: async () => {
            throw new Error("should not deliver");
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
      templateId: "humor-crocodilo",
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
      },
      packager: {
        createBatchZip: async (input) => {
          expect(input.videos.map((video) => video.id)).toEqual(["video-2"]);
          return { zipPath: "/tmp/rendered/batch-1.zip", fileName: "batch-1.zip" };
        }
      },
      storage: {
        uploadFile: async (input) => ({ key: input.key, url: `https://files.example.com/${input.key}` })
      },
      delivery: {
        deliverBatch: async () => undefined
      }
    });

    expect(result.status).toBe("completed");
    expect(result.videos.map((video) => [video.id, video.status, video.outputPath, video.outputUrl])).toEqual([
      ["video-1", "failed", undefined, undefined],
      ["video-2", "delivered", "/tmp/rendered/video-2.mp4", "https://files.example.com/batches/batch-1/videos/video-2.mp4"]
    ]);
  });
});
