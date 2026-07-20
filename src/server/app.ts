import Fastify from "fastify";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { webhookCallback, type Bot } from "grammy";
import type { AppEnv } from "../config/env.js";

export async function createHttpServer(options: { env: AppEnv; bot: Bot }) {
  const app = Fastify({
    logger: options.env.nodeEnv !== "test"
  });

  await app.register(helmet);
  await app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute"
  });

  app.get("/health", async () => ({
    ok: true,
    service: "geracao-em-massa-reels"
  }));

  app.post(
    `/telegram/${options.env.telegramWebhookSecret}`,
    {
      preHandler: async (request, reply) => {
        if (request.headers["x-telegram-bot-api-secret-token"] !== options.env.telegramWebhookSecret) {
          await reply.code(401).send({ ok: false });
        }
      }
    },
    webhookCallback(options.bot, "fastify")
  );

  return app;
}
