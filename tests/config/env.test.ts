import { describe, expect, it } from "vitest";
import { parseEnv } from "../../src/config/env.js";

describe("parseEnv", () => {
  const validEnv = {
    NODE_ENV: "test",
    PORT: "3000",
    TELEGRAM_BOT_TOKEN: "token",
    TELEGRAM_WEBHOOK_SECRET: "test-webhook-secret-32-bytes",
    TRUSTED_TELEGRAM_USER_IDS: "123,456",
    PUBLIC_WEBHOOK_BASE_URL: "https://bot.example.com",
    TURSO_DATABASE_URL: "file:/tmp/reels-bot-test.db",
    TURSO_AUTH_TOKEN: "token",
    REDIS_URL: "redis://localhost:6379",
    S3_ENDPOINT: "https://storage.example.com",
    S3_REGION: "auto",
    S3_BUCKET: "bucket",
    S3_ACCESS_KEY_ID: "key",
    S3_SECRET_ACCESS_KEY: "secret",
    PUBLIC_ASSET_BASE_URL: "https://files.example.com"
  };

  it("parses valid environment values", () => {
    const env = parseEnv({
      ...validEnv,
      WORK_DIR: ".data/reels-bot-test",
      MAX_BATCH_VIDEOS: "50",
      MAX_INPUT_BYTES: "20971520",
      MAX_TELEGRAM_SEND_BYTES: "52428800",
      WORKER_CONCURRENCY: "1"
    });

    expect(env.maxBatchVideos).toBe(50);
    expect(env.maxInputBytes).toBe(20 * 1024 * 1024);
    expect(env.trustedTelegramUserIds).toEqual(["123", "456"]);
  });

  it("uses an app-local work directory by default", () => {
    const env = parseEnv(validEnv);

    expect(env.workDir).toBe(".data/reels-bot");
  });

  it("rejects work directories inside the OS temp directory", () => {
    expect(() => parseEnv({ ...validEnv, WORK_DIR: "/tmp/reels-bot" })).toThrow("Invalid environment");
  });

  it("rejects missing required values", () => {
    expect(() => parseEnv({})).toThrow("Invalid environment");
  });
});
