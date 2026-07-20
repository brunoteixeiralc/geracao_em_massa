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
});

async function handleUpdate(store: BatchStore, update: Record<string, unknown>) {
  const bot = createTelegramBot({ env: testEnv(), store });
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
