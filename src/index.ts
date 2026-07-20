import "dotenv/config";
import { parseEnv } from "./config/env.js";
import { createTelegramBot } from "./bot/bot.js";
import { createDbClient } from "./db/client.js";
import { LibsqlBatchRepository } from "./db/repositories.js";
import { createHttpServer } from "./server/app.js";

const env = parseEnv(process.env);
const db = createDbClient(env);
const store = new LibsqlBatchRepository(db);
const bot = createTelegramBot({ env, store });
const app = await createHttpServer({ env, bot });

if (env.nodeEnv === "production") {
  await bot.api.setWebhook(`${env.publicWebhookBaseUrl}/telegram/${env.telegramWebhookSecret}`, {
    secret_token: env.telegramWebhookSecret
  });
}

await app.listen({ port: env.port, host: "0.0.0.0" });
