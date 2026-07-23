import { describe, expect, it } from "vitest";
import { createTelegramBot } from "../../src/bot/bot.js";
import type { BatchStore } from "../../src/bot/batchController.js";
import type { AppEnv } from "../../src/config/env.js";
import type { Batch } from "../../src/workflow/batchWorkflow.js";

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

describe("createTelegramBot", () => {
  it("rejects untrusted Telegram users before running commands", async () => {
    const store = new MemoryBatchStore();
    const calls = await handleUpdate(store, updateWithText("/start", 999));

    expect(calls).toEqual([
      {
        method: "sendMessage",
        payload: { chat_id: 999, text: "Acesso nao autorizado." }
      }
    ]);
    expect(store.batch).toBeNull();
  });

  it("creates a batch from /novo for trusted Telegram users", async () => {
    const store = new MemoryBatchStore();
    const calls = await handleUpdate(store, updateWithText("/novo", 123));

    expect(store.batch).toMatchObject({
      telegramUserId: "123",
      status: "draft"
    });
    expect(calls[0]).toMatchObject({
      method: "sendMessage",
      payload: {
        chat_id: 123
      }
    });
    expect(calls[0]?.payload.text).toContain("Escolha um template");
    expect(calls[0]?.payload.reply_markup).toBeDefined();
  });

  it("stores the edited Telegram message as the live status panel before queueing", async () => {
    const store = new MemoryBatchStore();
    store.batch = {
      id: "batch-1",
      telegramUserId: "123",
      status: "settings",
      templateId: "humor-cachorro",
      outputZipUrl: null,
      settings: {
        autoCut: true,
        zoomPercent: 105,
        speed: 1,
        mirror: false,
        trimStartSeconds: 0.3,
        trimEndSeconds: 0.3,
        antiduplication: true,
        cta: true,
        watermark: false
      },
      videos: [{ id: "video-1", fileId: "file-1", fileName: "one.mp4", sizeBytes: 1000, status: "received" }]
    };
    const queuedBatchIds: string[] = [];

    const calls = await handleUpdate(store, callbackUpdate("batch:process", 123), {
      enqueueBatch: async (batchId) => {
        queuedBatchIds.push(batchId);
      }
    });

    expect(store.batch).toMatchObject({
      status: "queued",
      statusPanelChatId: "123",
      statusPanelMessageId: 7
    });
    expect(queuedBatchIds).toEqual(["batch-1"]);
    expect(calls.map((call) => call.method)).toEqual(["answerCallbackQuery", "editMessageText"]);
  });

  it("routes all global setting callbacks to the active batch", async () => {
    const store = new MemoryBatchStore();
    store.batch = {
      id: "batch-1",
      telegramUserId: "123",
      status: "settings",
      templateId: "humor-cachorro",
      outputZipUrl: null,
      settings: {
        autoCut: true,
        zoomPercent: 105,
        speed: 1,
        mirror: false,
        trimStartSeconds: 0.3,
        trimEndSeconds: 0.3,
        antiduplication: true,
        cta: true,
        watermark: false
      },
      videos: [{ id: "video-1", fileId: "file-1", fileName: "one.mp4", sizeBytes: 1000, status: "received" }]
    };

    await handleUpdate(store, callbackUpdate("settings:trim_start:0.1", 123));
    await handleUpdate(store, callbackUpdate("settings:trim_end:-0.1", 123));
    await handleUpdate(store, callbackUpdate("settings:cta", 123));
    const calls = await handleUpdate(store, callbackUpdate("settings:watermark", 123));

    expect(store.batch?.settings).toMatchObject({
      trimStartSeconds: 0.4,
      trimEndSeconds: 0.2,
      cta: false,
      watermark: true
    });
    expect(calls.map((call) => call.method)).toEqual(["answerCallbackQuery", "editMessageText"]);
  });

  it("ignores Telegram message-not-modified errors after bounded setting taps", async () => {
    const store = new MemoryBatchStore();
    store.batch = {
      id: "batch-1",
      telegramUserId: "123",
      status: "settings",
      templateId: "humor-cachorro",
      outputZipUrl: null,
      settings: {
        autoCut: true,
        zoomPercent: 105,
        speed: 1.3,
        mirror: false,
        trimStartSeconds: 0.3,
        trimEndSeconds: 0.3,
        antiduplication: true,
        cta: true,
        watermark: false
      },
      videos: [{ id: "video-1", fileId: "file-1", fileName: "one.mp4", sizeBytes: 1000, status: "received" }]
    };

    const calls = await handleUpdate(
      store,
      callbackUpdate("settings:speed:0.1", 123),
      undefined,
      new Error(
        "Call to 'editMessageText' failed! (400: Bad Request: message is not modified: specified new message content and reply markup are exactly the same as a current content and reply markup of the message)"
      )
    );

    expect(store.batch?.settings.speed).toBe(1.3);
    expect(calls.map((call) => call.method)).toEqual(["answerCallbackQuery", "editMessageText"]);
  });
});

async function handleUpdate(
  store: BatchStore,
  update: Record<string, unknown>,
  queue?: { enqueueBatch(batchId: string): Promise<void> },
  editMessageTextError?: Error
) {
  const bot = createTelegramBot({ env: testEnv(), store, queue });
  bot.botInfo = {
    id: 123456,
    is_bot: true,
    first_name: "Reels Bot",
    username: "reels_bot",
    can_join_groups: false,
    can_read_all_group_messages: false,
    supports_inline_queries: false
  } as never;

  const calls: Array<{ method: string; payload: Record<string, unknown> }> = [];
  bot.api.config.use(async (_previous, method, payload) => {
    calls.push({ method, payload: payload as Record<string, unknown> });
    if (method === "editMessageText" && editMessageTextError) {
      throw editMessageTextError;
    }
    return {
      ok: true,
      result: {
        message_id: 1,
        date: 1,
        chat: { id: 123, type: "private" },
        text: "ok"
      }
    } as never;
  });

  await bot.handleUpdate(update as never);
  return calls;
}

function updateWithText(text: string, userId: number) {
  return {
    update_id: 1,
    message: {
      message_id: 1,
      date: 1,
      chat: { id: userId, type: "private" },
      from: { id: userId, is_bot: false, first_name: "User" },
      text,
      entities: [{ type: "bot_command", offset: 0, length: text.length }]
    }
  };
}

function callbackUpdate(data: string, userId: number) {
  return {
    update_id: 1,
    callback_query: {
      id: "callback-1",
      from: { id: userId, is_bot: false, first_name: "User" },
      message: {
        message_id: 7,
        date: 1,
        chat: { id: userId, type: "private" },
        text: "panel"
      },
      data
    }
  };
}

function testEnv(): AppEnv {
  return {
    nodeEnv: "test",
    port: 3000,
    telegramBotToken: "123456:test-token",
    telegramWebhookSecret: "secret-secret-secret",
    trustedTelegramUserIds: ["123"],
    publicWebhookBaseUrl: "https://example.com",
    tursoDatabaseUrl: "file:/tmp/test.db",
    tursoAuthToken: "token",
    redisUrl: "redis://localhost:6379",
    s3Endpoint: "https://s3.example.com",
    s3Region: "auto",
    s3Bucket: "bucket",
    s3AccessKeyId: "key",
    s3SecretAccessKey: "secret",
    publicAssetBaseUrl: "https://assets.example.com",
    workDir: "/tmp/reels-bot",
    maxBatchVideos: 50,
    maxInputBytes: 20 * 1024 * 1024,
    maxTelegramSendBytes: 50 * 1024 * 1024,
    workerConcurrency: 1
  };
}
