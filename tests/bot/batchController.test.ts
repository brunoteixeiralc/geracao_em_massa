import { describe, expect, it } from "vitest";
import { createBatchController, type BatchStore } from "../../src/bot/batchController.js";
import type { Batch } from "../../src/workflow/batchWorkflow.js";
import { DEFAULT_BATCH_SETTINGS } from "../../src/workflow/settings.js";
import { validateMediaInput } from "../../src/security/media.js";

class MemoryBatchStore implements BatchStore {
  batch: Batch | null = null;

  async createBatch(batch: Batch) {
    this.batch = structuredClone(batch);
  }

  async findActiveBatchByTelegramUserId(telegramUserId: string) {
    if (!this.batch || this.batch.telegramUserId !== telegramUserId || this.batch.status === "cancelled") {
      return null;
    }

    return structuredClone(this.batch);
  }

  async saveBatch(batch: Batch) {
    this.batch = structuredClone(batch);
  }
}

describe("batch controller", () => {
  it("starts a draft batch and asks for a template", async () => {
    const store = new MemoryBatchStore();
    const controller = createController(store, ["batch-1"]);

    const response = await controller.start({ telegramUserId: "123", username: "bruno" });

    expect(response.keyboard).toBe("templates");
    expect(response.batch).toMatchObject({
      id: "batch-1",
      telegramUserId: "123",
      status: "draft",
      settings: DEFAULT_BATCH_SETTINGS
    });
    expect(response.text).toContain("Escolha um template");
  });

  it("selects a fixed template and moves the batch to video receiving", async () => {
    const store = new MemoryBatchStore();
    const controller = createController(store, ["batch-1"]);

    await controller.start({ telegramUserId: "123" });
    const response = await controller.selectTemplate({ telegramUserId: "123" }, "humor-01");

    expect(response.keyboard).toBe("receiving");
    expect(response.batch?.status).toBe("receiving");
    expect(response.batch?.templateId).toBe("humor-01");
  });

  it("receives valid videos and persists them in the active batch", async () => {
    const store = new MemoryBatchStore();
    const controller = createController(store, ["batch-1"]);

    await controller.start({ telegramUserId: "123" });
    await controller.selectTemplate({ telegramUserId: "123" }, "humor-01");
    const response = await controller.receiveVideo(
      { telegramUserId: "123" },
      { id: "video-1", fileId: "file-1", fileName: "clip.mp4", mimeType: "video/mp4", sizeBytes: 1024 }
    );

    expect(response.keyboard).toBe("receiving");
    expect(response.batch?.videos).toEqual([
      { id: "video-1", fileId: "file-1", fileName: "clip.mp4", sizeBytes: 1024, status: "received" }
    ]);
    expect(response.text).toContain("1/50 recebidos");
  });

  it("rejects invalid videos before changing the batch", async () => {
    const store = new MemoryBatchStore();
    const controller = createController(store, ["batch-1"]);

    await controller.start({ telegramUserId: "123" });
    await controller.selectTemplate({ telegramUserId: "123" }, "humor-01");
    const response = await controller.receiveVideo(
      { telegramUserId: "123" },
      { id: "video-1", fileId: "file-1", fileName: "clip.exe", mimeType: "application/octet-stream", sizeBytes: 1024 }
    );

    expect(response.text).toBe("Envie apenas videos MP4, MOV ou WEBM.");
    expect(store.batch?.videos).toHaveLength(0);
  });

  it("applies settings globally before queueing the batch", async () => {
    const store = new MemoryBatchStore();
    const queuedBatchIds: string[] = [];
    const controller = createController(store, ["batch-1"], queuedBatchIds);

    await controller.start({ telegramUserId: "123" });
    await controller.selectTemplate({ telegramUserId: "123" }, "humor-01");
    await controller.receiveVideo(
      { telegramUserId: "123" },
      { id: "video-1", fileId: "file-1", fileName: "clip.mp4", mimeType: "video/mp4", sizeBytes: 1024 }
    );
    await controller.openSettings({ telegramUserId: "123" });
    await controller.updateSettings({ telegramUserId: "123" }, { type: "zoom_delta", delta: 5 });
    const response = await controller.queueBatch({ telegramUserId: "123" }, { chatId: "123", messageId: 456 });

    expect(response.batch?.status).toBe("queued");
    expect(response.batch?.statusPanelChatId).toBe("123");
    expect(response.batch?.statusPanelMessageId).toBe(456);
    expect(store.batch?.statusPanelChatId).toBe("123");
    expect(store.batch?.statusPanelMessageId).toBe(456);
    expect(response.batch?.settings.zoomPercent).toBe(110);
    expect(queuedBatchIds).toEqual(["batch-1"]);
    expect(response.text).toContain("Trabalho enviado para a fila");
  });
});

function createController(store: BatchStore, ids: string[], queuedBatchIds: string[] = []) {
  return createBatchController({
    store,
    queue: {
      enqueueBatch: async (batchId) => {
        queuedBatchIds.push(batchId);
      }
    },
    ids: () => ids.shift() ?? "fallback-id",
    maxBatchVideos: 50,
    maxInputBytes: 20 * 1024 * 1024,
    validateMedia: validateMediaInput
  });
}
