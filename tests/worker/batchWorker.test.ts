import { describe, expect, it } from "vitest";
import { createBatchWorker } from "../../src/worker/batchWorker.js";
import { BATCH_QUEUE_NAME, PROCESS_BATCH_JOB } from "../../src/queue/batchQueue.js";
import type { Batch } from "../../src/workflow/batchWorkflow.js";
import { DEFAULT_BATCH_SETTINGS } from "../../src/workflow/settings.js";

describe("createBatchWorker", () => {
  it("registers a BullMQ processor for queued batch jobs", async () => {
    const registrations: Array<{
      name: string;
      processor: (job: { name: string; data: { batchId: string } }) => Promise<unknown>;
      options: Record<string, unknown>;
    }> = [];
    const saved: Batch[] = [];

    createBatchWorker({
      redisUrl: "redis://localhost:6379",
      concurrency: 2,
      store: {
        async findBatchById() {
          return {
            id: "batch-1",
            telegramUserId: "123",
            templateId: "humor-01",
            status: "queued",
            settings: DEFAULT_BATCH_SETTINGS,
            videos: [{ id: "video-1", fileId: "file-1", fileName: "one.mp4", sizeBytes: 1000, status: "queued" }]
          };
        },
        async saveBatch(batch) {
          saved.push(structuredClone(batch));
        }
      },
      downloader: {
        async downloadVideo(input) {
          return { inputPath: `/tmp/${input.videoId}.mp4`, bytesWritten: 1000 };
        }
      },
      createWorker: (name, processor, options) => {
        registrations.push({ name, processor, options });
        return { close: async () => undefined };
      }
    });

    expect(registrations[0]?.name).toBe(BATCH_QUEUE_NAME);
    expect(registrations[0]?.options).toMatchObject({ concurrency: 2 });

    const result = await registrations[0].processor({ name: PROCESS_BATCH_JOB, data: { batchId: "batch-1" } });

    expect(result).toMatchObject({ status: "validating" });
    expect(saved.at(-1)).toMatchObject({ status: "validating" });
  });
});
