import { tmpdir } from "node:os";
import { isAbsolute, relative, resolve } from "node:path";
import { z } from "zod";

const tempRoots = [tmpdir(), "/tmp", "/var/tmp"].map((path) => resolve(path));

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(16),
  TRUSTED_TELEGRAM_USER_IDS: z.string().min(1),
  PUBLIC_WEBHOOK_BASE_URL: z.string().url(),
  TURSO_DATABASE_URL: z.string().min(1),
  TURSO_AUTH_TOKEN: z.string().min(1),
  REDIS_URL: z.string().startsWith("redis"),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  PUBLIC_ASSET_BASE_URL: z.string().url(),
  WORK_DIR: z.string().min(1).default(".data/reels-bot").refine((value) => !isInsideAnyTempRoot(value)),
  MAX_BATCH_VIDEOS: z.coerce.number().int().positive().max(50).default(50),
  MAX_INPUT_BYTES: z.coerce.number().int().positive().default(20 * 1024 * 1024),
  MAX_TELEGRAM_SEND_BYTES: z.coerce.number().int().positive().default(50 * 1024 * 1024),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().max(3).default(1)
});

function isInsideAnyTempRoot(path: string) {
  const resolvedPath = resolve(path);
  return tempRoots.some((tempRoot) => isInsidePath(tempRoot, resolvedPath));
}

function isInsidePath(parentPath: string, childPath: string) {
  const pathFromParent = relative(parentPath, childPath);
  return pathFromParent === "" || (pathFromParent !== "" && !pathFromParent.startsWith("..") && !isAbsolute(pathFromParent));
}

export type AppEnv = ReturnType<typeof parseEnv>;

export function parseEnv(source: NodeJS.ProcessEnv) {
  const result = schema.safeParse(source);

  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid environment: ${fields}`);
  }

  return {
    nodeEnv: result.data.NODE_ENV,
    port: result.data.PORT,
    telegramBotToken: result.data.TELEGRAM_BOT_TOKEN,
    telegramWebhookSecret: result.data.TELEGRAM_WEBHOOK_SECRET,
    trustedTelegramUserIds: result.data.TRUSTED_TELEGRAM_USER_IDS.split(",")
      .map((id) => id.trim())
      .filter(Boolean),
    publicWebhookBaseUrl: result.data.PUBLIC_WEBHOOK_BASE_URL,
    tursoDatabaseUrl: result.data.TURSO_DATABASE_URL,
    tursoAuthToken: result.data.TURSO_AUTH_TOKEN,
    redisUrl: result.data.REDIS_URL,
    s3Endpoint: result.data.S3_ENDPOINT,
    s3Region: result.data.S3_REGION,
    s3Bucket: result.data.S3_BUCKET,
    s3AccessKeyId: result.data.S3_ACCESS_KEY_ID,
    s3SecretAccessKey: result.data.S3_SECRET_ACCESS_KEY,
    publicAssetBaseUrl: result.data.PUBLIC_ASSET_BASE_URL,
    workDir: result.data.WORK_DIR,
    maxBatchVideos: result.data.MAX_BATCH_VIDEOS,
    maxInputBytes: result.data.MAX_INPUT_BYTES,
    maxTelegramSendBytes: result.data.MAX_TELEGRAM_SEND_BYTES,
    workerConcurrency: result.data.WORKER_CONCURRENCY
  };
}
