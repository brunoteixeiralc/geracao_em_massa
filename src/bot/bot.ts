import { Bot, type Context, type InlineKeyboard } from "grammy";
import { nanoid } from "nanoid";
import { validateMediaInput } from "../security/media.js";
import { isTrustedTelegramUser } from "../security/access.js";
import { type AppEnv } from "../config/env.js";
import { type BatchStore, createBatchController, type BatchControllerResponse } from "./batchController.js";
import { receivingKeyboard, settingsKeyboard, templateKeyboard } from "./keyboards.js";

export function createTelegramBot(options: { env: AppEnv; store: BatchStore }) {
  const bot = new Bot(options.env.telegramBotToken);
  const controller = createBatchController({
    store: options.store,
    ids: () => nanoid(),
    maxBatchVideos: options.env.maxBatchVideos,
    maxInputBytes: options.env.maxInputBytes,
    validateMedia: validateMediaInput
  });

  bot.use(async (ctx, next) => {
    const telegramUserId = ctx.from?.id.toString();
    if (!isTrustedTelegramUser(telegramUserId, options.env.trustedTelegramUserIds)) {
      await ctx.reply("Acesso nao autorizado.");
      return;
    }

    await next();
  });

  bot.command("start", async (ctx) => {
    await ctx.reply(
      [
        "Geracao em massa de Reels.",
        "",
        "Use /novo para criar um lote, escolha o template e envie seus videos."
      ].join("\n")
    );
  });

  bot.command("novo", async (ctx) => {
    await respond(ctx, () => controller.start(readUser(ctx)));
  });

  bot.callbackQuery(/^template:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await respond(ctx, () => controller.selectTemplate(readUser(ctx), ctx.match[1]));
  });

  bot.callbackQuery("batch:settings", async (ctx) => {
    await ctx.answerCallbackQuery();
    await respond(ctx, () => controller.openSettings(readUser(ctx)));
  });

  bot.callbackQuery(/^settings:zoom:(-?\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await respond(ctx, () => controller.updateSettings(readUser(ctx), { type: "zoom_delta", delta: Number(ctx.match[1]) }));
  });

  bot.callbackQuery(/^settings:speed:(-?\d+(?:\.\d+)?)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await respond(ctx, () => controller.updateSettings(readUser(ctx), { type: "speed_delta", delta: Number(ctx.match[1]) }));
  });

  bot.callbackQuery("settings:mirror", async (ctx) => {
    await ctx.answerCallbackQuery();
    await respond(ctx, () => controller.updateSettings(readUser(ctx), { type: "toggle_mirror" }));
  });

  bot.callbackQuery("settings:auto_cut", async (ctx) => {
    await ctx.answerCallbackQuery();
    await respond(ctx, () => controller.updateSettings(readUser(ctx), { type: "toggle_auto_cut" }));
  });

  bot.callbackQuery("settings:antiduplication", async (ctx) => {
    await ctx.answerCallbackQuery();
    await respond(ctx, () => controller.updateSettings(readUser(ctx), { type: "toggle_antiduplication" }));
  });

  bot.callbackQuery("batch:process", async (ctx) => {
    await ctx.answerCallbackQuery();
    await respond(ctx, () => controller.queueBatch(readUser(ctx)));
  });

  bot.callbackQuery("batch:cancel", async (ctx) => {
    await ctx.answerCallbackQuery();
    await respond(ctx, () => controller.cancelBatch(readUser(ctx)));
  });

  bot.on("message:video", async (ctx) => {
    await respond(ctx, () => controller.receiveVideo(readUser(ctx), videoFromMessage(ctx)));
  });

  bot.on("message:document", async (ctx) => {
    await respond(ctx, () => controller.receiveVideo(readUser(ctx), documentFromMessage(ctx)));
  });

  bot.catch(async (error) => {
    console.error("Telegram bot error", error.error);
  });

  return bot;
}

async function respond(ctx: Context, action: () => Promise<BatchControllerResponse>) {
  try {
    await sendResponse(ctx, await action());
  } catch (error) {
    const text = error instanceof Error ? error.message : "Nao consegui processar essa acao.";
    await sendResponse(ctx, { text, keyboard: null });
  }
}

function readUser(ctx: Context) {
  if (!ctx.from) {
    throw new Error("Telegram update without user context");
  }

  return {
    telegramUserId: ctx.from.id.toString(),
    username: ctx.from.username
  };
}

function videoFromMessage(ctx: Context) {
  const video = ctx.message?.video;
  if (!video) {
    throw new Error("Telegram update without video");
  }

  return {
    id: nanoid(),
    fileId: video.file_id,
    fileName: `${video.file_unique_id}.mp4`,
    mimeType: video.mime_type,
    sizeBytes: video.file_size
  };
}

function documentFromMessage(ctx: Context) {
  const document = ctx.message?.document;
  if (!document) {
    throw new Error("Telegram update without document");
  }

  return {
    id: nanoid(),
    fileId: document.file_id,
    fileName: document.file_name ?? `${document.file_unique_id}.mp4`,
    mimeType: document.mime_type,
    sizeBytes: document.file_size
  };
}

async function sendResponse(ctx: Context, response: BatchControllerResponse) {
  const replyMarkup = keyboardFor(response.keyboard);

  if (ctx.callbackQuery?.message) {
    await ctx.editMessageText(response.text, replyMarkup ? { reply_markup: replyMarkup } : undefined);
    return;
  }

  await ctx.reply(response.text, replyMarkup ? { reply_markup: replyMarkup } : undefined);
}

function keyboardFor(name: BatchControllerResponse["keyboard"]): InlineKeyboard | undefined {
  if (name === "templates") {
    return templateKeyboard();
  }

  if (name === "receiving") {
    return receivingKeyboard();
  }

  if (name === "settings") {
    return settingsKeyboard();
  }

  return undefined;
}
