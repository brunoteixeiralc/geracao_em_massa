import { describe, expect, it } from "vitest";
import { createTelegramStatusPanelUpdater } from "../../src/bot/statusPanelUpdater.js";
import { createDraftBatch, selectTemplate } from "../../src/workflow/batchWorkflow.js";

describe("createTelegramStatusPanelUpdater", () => {
  it("edits the stored Telegram panel message with live batch status", async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    const updater = createTelegramStatusPanelUpdater({
      botToken: "123456:test-token",
      fetch: async (url, init) => {
        calls.push({ url: url.toString(), body: JSON.parse(String(init?.body)) });
        return { ok: true } as Response;
      }
    });
    const batch = {
      ...selectTemplate(createDraftBatch({ id: "batch-1", telegramUserId: "123" }), "humor-crocodilo"),
      status: "rendering" as const,
      statusPanelChatId: "123",
      statusPanelMessageId: 456,
      videos: [{ id: "video-1", fileId: "file-1", fileName: "one.mp4", sizeBytes: 1000, status: "ready" as const }]
    };

    await updater.updateBatchStatus(batch);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.telegram.org/bot123456:test-token/editMessageText");
    expect(calls[0].body).toMatchObject({
      chat_id: "123",
      message_id: 456
    });
    expect(JSON.stringify(calls[0].body)).toContain("Fase: Renderizando");
  });

  it("skips batches without a stored panel message", async () => {
    const calls: unknown[] = [];
    const updater = createTelegramStatusPanelUpdater({
      botToken: "123456:test-token",
      fetch: async () => {
        calls.push("called");
        return { ok: true } as Response;
      }
    });

    await updater.updateBatchStatus(createDraftBatch({ id: "batch-1", telegramUserId: "123" }));

    expect(calls).toEqual([]);
  });
});
