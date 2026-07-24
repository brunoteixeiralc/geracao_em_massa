import { join } from "node:path";
import { Bot, InputFile, type Context, type InlineKeyboard } from "grammy";
import { nanoid } from "nanoid";
import { validateMediaInput } from "../security/media.js";
import { isTrustedTelegramUser } from "../security/access.js";
import { type AppEnv } from "../config/env.js";
import { TEMPLATES } from "../templates/templates.js";
import { type BatchQueue, type BatchStore, createBatchController, type BatchControllerResponse } from "./batchController.js";
import { receivingKeyboard, settingsKeyboard, templateKeyboard, templatePreviewKeyboard } from "./keyboards.js";

export function createTelegramBot(options: { env: AppEnv; store: BatchStore; queue?: BatchQueue }) {
  const bot = new Bot(options.env.telegramBotToken);
  const controller = createBatchController({
    store: options.store,
    queue: options.queue,
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
        "Use /novo para criar um lote, escolha o template e envie seus videos.",
        "Use /templates para ver os templates disponiveis.",
        "Use /status para acompanhar o lote atual ou recuperar o ultimo resultado."
      ].join("\n")
    );
  });

  bot.command("novo", async (ctx) => {
    await respond(ctx, options.store, () => controller.start(readUser(ctx)));
  });

  bot.command("status", async (ctx) => {
    await respond(ctx, options.store, () => controller.showStatus(readUser(ctx)));
  });

  bot.command("templates", async (ctx) => {
    await respond(ctx, options.store, () => controller.showTemplates(readUser(ctx)));
  });

  bot.callbackQuery(/^template:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await respond(ctx, options.store, () => controller.selectTemplate(readUser(ctx), ctx.match[1]));
  });

  bot.callbackQuery("batch:settings", async (ctx) => {
    await ctx.answerCallbackQuery();
    await respond(ctx, options.store, () => controller.openSettings(readUser(ctx)));
  });

  bot.callbackQuery(/^settings:zoom:(-?\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await respond(ctx, options.store, () => controller.updateSettings(readUser(ctx), { type: "zoom_delta", delta: Number(ctx.match[1]) }));
  });

  bot.callbackQuery(/^settings:speed:(-?\d+(?:\.\d+)?)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await respond(ctx, options.store, () => controller.updateSettings(readUser(ctx), { type: "speed_delta", delta: Number(ctx.match[1]) }));
  });

  bot.callbackQuery(/^settings:trim_start:(-?\d+(?:\.\d+)?)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await respond(ctx, options.store, () =>
      controller.updateSettings(readUser(ctx), { type: "trim_start_delta", delta: Number(ctx.match[1]) })
    );
  });

  bot.callbackQuery(/^settings:trim_end:(-?\d+(?:\.\d+)?)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await respond(ctx, options.store, () =>
      controller.updateSettings(readUser(ctx), { type: "trim_end_delta", delta: Number(ctx.match[1]) })
    );
  });

  bot.callbackQuery("settings:mirror", async (ctx) => {
    await ctx.answerCallbackQuery();
    await respond(ctx, options.store, () => controller.updateSettings(readUser(ctx), { type: "toggle_mirror" }));
  });

  bot.callbackQuery("settings:auto_cut", async (ctx) => {
    await ctx.answerCallbackQuery();
    await respond(ctx, options.store, () => controller.updateSettings(readUser(ctx), { type: "toggle_auto_cut" }));
  });

  bot.callbackQuery("settings:antiduplication", async (ctx) => {
    await ctx.answerCallbackQuery();
    await respond(ctx, options.store, () => controller.updateSettings(readUser(ctx), { type: "toggle_antiduplication" }));
  });

  bot.callbackQuery("settings:cta", async (ctx) => {
    await ctx.answerCallbackQuery();
    await respond(ctx, options.store, () => controller.updateSettings(readUser(ctx), { type: "toggle_cta" }));
  });

  bot.callbackQuery("settings:watermark", async (ctx) => {
    await ctx.answerCallbackQuery();
    await respond(ctx, options.store, () => controller.updateSettings(readUser(ctx), { type: "toggle_watermark" }));
  });

  bot.callbackQuery("batch:process", async (ctx) => {
    await ctx.answerCallbackQuery();
    await respond(ctx, options.store, () => controller.queueBatch(readUser(ctx), readStatusPanelRef(ctx)));
  });

  bot.callbackQuery("batch:cancel", async (ctx) => {
    await ctx.answerCallbackQuery();
    await respond(ctx, options.store, () => controller.cancelBatch(readUser(ctx)));
  });

  bot.on("message:video", async (ctx) => {
    await respond(ctx, options.store, () => controller.receiveVideo(readUser(ctx), videoFromMessage(ctx)));
  });

  bot.on("message:document", async (ctx) => {
    await respond(ctx, options.store, () => controller.receiveVideo(readUser(ctx), documentFromMessage(ctx)));
  });

  bot.catch(async (error) => {
    console.error("Telegram bot error", error.error);
  });

  return bot;
}

async function respond(ctx: Context, store: BatchStore, action: () => Promise<BatchControllerResponse>) {
  try {
    const response = await action();
    const panelRef = await sendResponse(ctx, response);
    if (
      response.captureStatusPanel &&
      response.batch &&
      panelRef &&
      (!response.batch.statusPanelChatId || !response.batch.statusPanelMessageId)
    ) {
      await store.saveBatch({
        ...response.batch,
        statusPanelChatId: panelRef.chatId,
        statusPanelMessageId: panelRef.messageId
      });
    }
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

function readStatusPanelRef(ctx: Context) {
  if (!ctx.callbackQuery?.message) {
    return undefined;
  }

  return {
    chatId: ctx.callbackQuery.message.chat.id.toString(),
    messageId: ctx.callbackQuery.message.message_id
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

async function sendResponse(ctx: Context, response: BatchControllerResponse): Promise<{ chatId: string; messageId: number } | null> {
  const replyMarkup = keyboardFor(response.keyboard);

  if (ctx.callbackQuery?.message) {
    try {
      await ctx.editMessageText(response.text, replyMarkup ? { reply_markup: replyMarkup } : undefined);
    } catch (error) {
      if (!isTelegramMessageNotModifiedError(error)) {
        throw error;
      }
    }

    return {
      chatId: ctx.callbackQuery.message.chat.id.toString(),
      messageId: ctx.callbackQuery.message.message_id
    };
  }

  if (response.templatePreviews) {
    await sendTemplatePreviews(ctx, response.templatePreviews);
  }

  const message = await ctx.reply(response.text, replyMarkup ? { reply_markup: replyMarkup } : undefined);
  return {
    chatId: message.chat.id.toString(),
    messageId: message.message_id
  };
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

async function sendTemplatePreviews(ctx: Context, options: { selectable: boolean }) {
  for (const template of TEMPLATES) {
    try {
      await ctx.replyWithPhoto(new InputFile(join(process.cwd(), template.previewPath)), {
        caption: [`Template: ${template.name}`, `ID: ${template.id}`, `Tipo: ${template.kind}`].join("\n"),
        reply_markup: options.selectable ? templatePreviewKeyboard(template.id) : undefined
      });
    } catch (error) {
      console.warn(`Could not send template preview ${template.id}`, error);
    }
  }
}

function isTelegramMessageNotModifiedError(error: unknown) {
  return error instanceof Error && error.message.includes("message is not modified");
}
