import { getTemplateById, TEMPLATES } from "../templates/templates.js";
import {
  createDraftBatch,
  openSettings,
  receiveVideo,
  selectTemplate,
  startProcessing,
  type Batch,
  type BatchVideo
} from "../workflow/batchWorkflow.js";
import { updateSetting, type SettingAction } from "../workflow/settings.js";
import { renderBatchPanel } from "./panel.js";

export type BatchStore = {
  createBatch(batch: Batch, username?: string): Promise<void>;
  findActiveBatchByTelegramUserId(telegramUserId: string): Promise<Batch | null>;
  findLatestBatchByTelegramUserId(telegramUserId: string): Promise<Batch | null>;
  saveBatch(batch: Batch): Promise<void>;
};

export type BatchQueue = {
  enqueueBatch(batchId: string): Promise<void>;
};

export type TelegramUserRef = {
  telegramUserId: string;
  username?: string;
};

export type TelegramVideoInput = {
  id: string;
  fileId: string;
  fileName: string;
  mimeType?: string;
  sizeBytes?: number;
};

export type InstagramLinkInput = {
  id: string;
  url: string;
};

export type MediaValidator = (input: {
  fileName: string;
  mimeType: string | undefined;
  sizeBytes: number | undefined;
  maxInputBytes: number;
}) => { ok: true } | { ok: false; reason: string };

export type BatchControllerResponse = {
  text: string;
  keyboard: "templates" | "receiving" | "settings" | null;
  templatePreviews?: {
    selectable: boolean;
  };
  captureStatusPanel?: boolean;
  batch?: Batch;
};

export type BatchControllerOptions = {
  store: BatchStore;
  queue?: BatchQueue;
  ids: () => string;
  maxBatchVideos: number;
  maxInputBytes: number;
  instagramDownloadEnabled: boolean;
  validateMedia: MediaValidator;
};

export function createBatchController(options: BatchControllerOptions) {
  return {
    async start(user: TelegramUserRef): Promise<BatchControllerResponse> {
      const batch = createDraftBatch({ id: options.ids(), telegramUserId: user.telegramUserId });
      await options.store.createBatch(batch, user.username);

      return {
        text: ["Novo trabalho criado.", "", renderBatchPanel(batch), "", "Escolha um template para continuar."].join("\n"),
        keyboard: "templates",
        templatePreviews: { selectable: true },
        batch
      };
    },

    async showTemplates(user: TelegramUserRef): Promise<BatchControllerResponse> {
      const activeBatch = await options.store.findActiveBatchByTelegramUserId(user.telegramUserId);
      const selectable = activeBatch ? canSelectTemplate(activeBatch) : false;
      const lines = [
        "Templates disponiveis.",
        "",
        ...TEMPLATES.map((template) => `- ${template.name} (${template.kind}) · ${template.id}`),
        "",
        selectable
          ? "Toque em Usar este template no preview para aplicar ao lote atual."
          : "Use /novo para criar um lote e aplicar um template."
      ];

      return {
        text: lines.join("\n"),
        keyboard: null,
        templatePreviews: { selectable },
        batch: activeBatch ?? undefined
      };
    },

    async showStatus(user: TelegramUserRef): Promise<BatchControllerResponse> {
      const activeBatch = await options.store.findActiveBatchByTelegramUserId(user.telegramUserId);
      if (activeBatch) {
        return {
          text: renderBatchPanel(activeBatch),
          keyboard: keyboardForBatchStatus(activeBatch),
          batch: activeBatch
        };
      }

      const latestBatch = await options.store.findLatestBatchByTelegramUserId(user.telegramUserId);
      if (latestBatch) {
        return {
          text: ["Ultimo lote encontrado.", "", renderBatchPanel(latestBatch)].join("\n"),
          keyboard: null,
          batch: latestBatch
        };
      }

      return {
        text: "Nenhum lote encontrado. Use /novo para comecar.",
        keyboard: null
      };
    },

    async selectTemplate(user: TelegramUserRef, templateId: string): Promise<BatchControllerResponse> {
      const template = getTemplateById(templateId);
      if (!template) {
        return { text: "Template nao encontrado.", keyboard: "templates" };
      }

      const batch = await requireActiveBatch(options.store, user.telegramUserId);
      const updated = selectTemplate(batch, templateId);
      await options.store.saveBatch(updated);

      return {
        text: [renderBatchPanel(updated), "", "Envie os videos do lote. Quando terminar, toque em Finalizar envio."].join("\n"),
        keyboard: "receiving",
        batch: updated
      };
    },

    async receiveVideo(user: TelegramUserRef, video: TelegramVideoInput): Promise<BatchControllerResponse> {
      const validation = options.validateMedia({
        fileName: video.fileName,
        mimeType: video.mimeType,
        sizeBytes: video.sizeBytes,
        maxInputBytes: options.maxInputBytes
      });

      if (!validation.ok) {
        return { text: validation.reason, keyboard: "receiving" };
      }

      const batch = await requireActiveBatch(options.store, user.telegramUserId);
      const updated = receiveVideo(batch, toBatchVideo(video), options.maxBatchVideos);
      await options.store.saveBatch(updated);

      return {
        text: [renderBatchPanel(updated), "", "Video recebido. Envie mais videos ou finalize o envio."].join("\n"),
        keyboard: "receiving",
        batch: updated
      };
    },

    async receiveInstagramLinks(user: TelegramUserRef, links: InstagramLinkInput[]): Promise<BatchControllerResponse> {
      if (!options.instagramDownloadEnabled) {
        return {
          text: "Download por link do Instagram ainda esta desativado neste ambiente. Envie o video como anexo.",
          keyboard: "receiving"
        };
      }

      if (links.length === 0) {
        return {
          text: "Nao encontrei links validos do Instagram. Envie links de Reels, posts ou IGTV.",
          keyboard: "receiving"
        };
      }

      const batch = await requireActiveBatch(options.store, user.telegramUserId);
      let updated = batch;
      for (const link of links) {
        updated = receiveVideo(updated, toBatchInstagramVideo(link), options.maxBatchVideos);
      }
      await options.store.saveBatch(updated);

      return {
        text: [
          renderBatchPanel(updated),
          "",
          links.length === 1
            ? "Link recebido. Ele sera baixado no servidor quando o lote for processado."
            : `${links.length} links recebidos. Eles serao baixados no servidor quando o lote for processado.`,
          "Envie mais videos/links ou finalize o envio."
        ].join("\n"),
        keyboard: "receiving",
        batch: updated
      };
    },

    async openSettings(user: TelegramUserRef): Promise<BatchControllerResponse> {
      const batch = await requireActiveBatch(options.store, user.telegramUserId);
      const updated = openSettings(batch);
      await options.store.saveBatch(updated);

      return {
        text: renderBatchPanel(updated),
        keyboard: "settings",
        batch: updated
      };
    },

    async updateSettings(user: TelegramUserRef, action: SettingAction): Promise<BatchControllerResponse> {
      const batch = await requireActiveBatch(options.store, user.telegramUserId);
      if (batch.status !== "settings") {
        return { text: "Finalize o envio dos videos antes de alterar os ajustes.", keyboard: "receiving", batch };
      }

      const updated: Batch = { ...batch, settings: updateSetting(batch.settings, action) };
      await options.store.saveBatch(updated);

      return {
        text: renderBatchPanel(updated),
        keyboard: "settings",
        batch: updated
      };
    },

    async queueBatch(
      user: TelegramUserRef,
      statusPanel?: { chatId: string; messageId: number }
    ): Promise<BatchControllerResponse> {
      const batch = await requireActiveBatch(options.store, user.telegramUserId);
      const processingBatch = startProcessing(batch);
      const updated: Batch = statusPanel
        ? {
            ...processingBatch,
            statusPanelChatId: statusPanel.chatId,
            statusPanelMessageId: statusPanel.messageId
          }
        : processingBatch;
      await options.store.saveBatch(updated);
      await options.queue?.enqueueBatch(updated.id);

      return {
        text: [renderBatchPanel(updated), "", "Trabalho enviado para a fila. O processamento continua no servidor."].join("\n"),
        keyboard: null,
        captureStatusPanel: true,
        batch: updated
      };
    },

    async cancelBatch(user: TelegramUserRef): Promise<BatchControllerResponse> {
      const batch = await requireActiveBatch(options.store, user.telegramUserId);
      const updated: Batch = { ...batch, status: "cancelled" };
      await options.store.saveBatch(updated);

      return {
        text: "Lote cancelado.",
        keyboard: null,
        batch: updated
      };
    }
  };
}

function keyboardForBatchStatus(batch: Batch): BatchControllerResponse["keyboard"] {
  if (batch.status === "draft") {
    return "templates";
  }

  if (batch.status === "receiving") {
    return "receiving";
  }

  if (batch.status === "settings") {
    return "settings";
  }

  return null;
}

function canSelectTemplate(batch: Batch) {
  return batch.status === "draft" || batch.status === "receiving";
}

async function requireActiveBatch(store: BatchStore, telegramUserId: string) {
  const batch = await store.findActiveBatchByTelegramUserId(telegramUserId);
  if (!batch) {
    throw new Error("Nenhum lote ativo. Use /novo para comecar.");
  }

  return batch;
}

function toBatchVideo(video: TelegramVideoInput): Omit<BatchVideo, "status"> {
  return {
    id: video.id,
    sourceType: "telegram_file",
    fileId: video.fileId,
    sourceUrl: null,
    fileName: video.fileName,
    sizeBytes: video.sizeBytes ?? 0
  };
}

function toBatchInstagramVideo(link: InstagramLinkInput): Omit<BatchVideo, "status"> {
  return {
    id: link.id,
    sourceType: "instagram_url",
    fileId: "",
    sourceUrl: link.url,
    fileName: `${link.id}.mp4`,
    sizeBytes: 0
  };
}
