import { describe, expect, it } from "vitest";
import { createDraftBatch, openSettings, receiveVideo, selectTemplate, startProcessing } from "../../src/workflow/batchWorkflow.js";
import { DEFAULT_BATCH_SETTINGS } from "../../src/workflow/settings.js";

describe("batch workflow", () => {
  it("creates a draft batch", () => {
    const batch = createDraftBatch({ id: "batch-1", telegramUserId: "123" });

    expect(batch.status).toBe("draft");
    expect(batch.settings).toEqual(DEFAULT_BATCH_SETTINGS);
  });

  it("moves to receiving after template selection", () => {
    const batch = selectTemplate(createDraftBatch({ id: "batch-1", telegramUserId: "123" }), "humor-01");

    expect(batch.status).toBe("receiving");
    expect(batch.templateId).toBe("humor-01");
  });

  it("accepts up to the configured batch limit", () => {
    let batch = selectTemplate(createDraftBatch({ id: "batch-1", telegramUserId: "123" }), "humor-01");
    batch = receiveVideo(batch, { id: "video-1", fileId: "file-1", fileName: "one.mp4", sizeBytes: 1000 }, 1);

    expect(batch.videos).toHaveLength(1);
    expect(() =>
      receiveVideo(batch, { id: "video-2", fileId: "file-2", fileName: "two.mp4", sizeBytes: 1000 }, 1)
    ).toThrow("Batch video limit reached");
  });

  it("queues a batch with videos", () => {
    let batch = selectTemplate(createDraftBatch({ id: "batch-1", telegramUserId: "123" }), "humor-01");
    batch = receiveVideo(batch, { id: "video-1", fileId: "file-1", fileName: "one.mp4", sizeBytes: 1000 }, 50);
    batch = openSettings(batch);
    batch = startProcessing(batch);

    expect(batch.status).toBe("queued");
    expect(batch.videos).toEqual([{ id: "video-1", fileId: "file-1", fileName: "one.mp4", sizeBytes: 1000, status: "queued" }]);
  });

  it("requires the settings review before queueing", () => {
    let batch = selectTemplate(createDraftBatch({ id: "batch-1", telegramUserId: "123" }), "humor-01");
    batch = receiveVideo(batch, { id: "video-1", fileId: "file-1", fileName: "one.mp4", sizeBytes: 1000 }, 50);

    expect(() => startProcessing(batch)).toThrow("Cannot process before reviewing settings");
  });
});
