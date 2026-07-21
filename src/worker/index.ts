import "dotenv/config";
import { parseEnv } from "../config/env.js";
import { createDbClient } from "../db/client.js";
import { LibsqlBatchRepository } from "../db/repositories.js";
import { createBatchWorker } from "./batchWorker.js";
import { createTelegramFileDownloader } from "./telegramFileDownloader.js";
import { createFfmpegRenderer } from "../renderer/ffmpegRenderer.js";
import { createZipPackager } from "../packager/zipPackager.js";
import { createS3Client, createS3Storage } from "../storage/s3Storage.js";
import { createTelegramDelivery } from "../delivery/telegramDelivery.js";
import { createTelegramStatusPanelUpdater } from "../bot/statusPanelUpdater.js";

const env = parseEnv(process.env);
const db = createDbClient(env);
const store = new LibsqlBatchRepository(db);
const downloader = createTelegramFileDownloader({
  botToken: env.telegramBotToken,
  workDir: env.workDir,
  maxInputBytes: env.maxInputBytes
});
const renderer = createFfmpegRenderer({
  workDir: env.workDir
});
const packager = createZipPackager({
  workDir: env.workDir
});
const storage = createS3Storage({
  bucket: env.s3Bucket,
  publicAssetBaseUrl: env.publicAssetBaseUrl,
  client: createS3Client({
    endpoint: env.s3Endpoint,
    region: env.s3Region,
    accessKeyId: env.s3AccessKeyId,
    secretAccessKey: env.s3SecretAccessKey
  })
});
const delivery = createTelegramDelivery({
  botToken: env.telegramBotToken,
  maxTelegramSendBytes: env.maxTelegramSendBytes
});
const statusNotifier = createTelegramStatusPanelUpdater({
  botToken: env.telegramBotToken
});

createBatchWorker({
  redisUrl: env.redisUrl,
  concurrency: env.workerConcurrency,
  store,
  downloader,
  renderer,
  packager,
  storage,
  delivery,
  statusNotifier
});

console.log(`Reels worker started with concurrency ${env.workerConcurrency}`);
