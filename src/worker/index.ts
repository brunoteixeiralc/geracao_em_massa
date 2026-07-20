import "dotenv/config";
import { parseEnv } from "../config/env.js";
import { createDbClient } from "../db/client.js";
import { LibsqlBatchRepository } from "../db/repositories.js";
import { createBatchWorker } from "./batchWorker.js";
import { createTelegramFileDownloader } from "./telegramFileDownloader.js";

const env = parseEnv(process.env);
const db = createDbClient(env);
const store = new LibsqlBatchRepository(db);
const downloader = createTelegramFileDownloader({
  botToken: env.telegramBotToken,
  workDir: env.workDir,
  maxInputBytes: env.maxInputBytes
});

createBatchWorker({
  redisUrl: env.redisUrl,
  concurrency: env.workerConcurrency,
  store,
  downloader
});

console.log(`Reels worker started with concurrency ${env.workerConcurrency}`);
