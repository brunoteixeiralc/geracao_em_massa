import { Bot } from "grammy";
import { describe, expect, it } from "vitest";
import { createHttpServer } from "../../src/server/app.js";
import type { AppEnv } from "../../src/config/env.js";

describe("createHttpServer", () => {
  it("exposes a health check for Railway", async () => {
    const app = await createHttpServer({
      env: testEnv(),
      bot: new Bot("123456:test-token")
    });

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, service: "geracao-em-massa-reels" });

    await app.close();
  });

  it("rejects Telegram webhook calls with an invalid secret token", async () => {
    const app = await createHttpServer({
      env: testEnv(),
      bot: new Bot("123456:test-token")
    });

    const response = await app.inject({
      method: "POST",
      url: "/telegram/secret-secret-secret",
      headers: {
        "x-telegram-bot-api-secret-token": "wrong-secret"
      },
      payload: {}
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ ok: false });

    await app.close();
  });
});

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
