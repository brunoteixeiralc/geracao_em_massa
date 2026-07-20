import "dotenv/config";
import { parseEnv } from "../config/env.js";
import { createDbClient } from "../db/client.js";
import { LibsqlBatchRepository } from "../db/repositories.js";
import { createBatchWorker } from "./batchWorker.js";
import { createTelegramFileDownloader } from "./telegramFileDownloader.js";
import { createFfmpegRenderer } from "../renderer/ffmpegRenderer.js";

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

createBatchWorker({
  redisUrl: env.redisUrl,
  concurrency: env.workerConcurrency,
  store,
  downloader,
  renderer
});

console.log(`Reels worker started with concurrency ${env.workerConcurrency}`);
