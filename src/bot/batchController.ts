import { getTemplateById } from "../templates/templates.js";
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
  saveBatch(batch: Batch): Promise<void>;
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

export type MediaValidator = (input: {
  fileName: string;
  mimeType: string | undefined;
  sizeBytes: number | undefined;
  maxInputBytes: number;
}) => { ok: true } | { ok: false; reason: string };

export type BatchControllerResponse = {
  text: string;
  keyboard: "templates" | "receiving" | "settings" | null;
  batch?: Batch;
};

export type BatchControllerOptions = {
  store: BatchStore;
  ids: () => string;
  maxBatchVideos: number;
  maxInputBytes: number;
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
        batch
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

    async queueBatch(user: TelegramUserRef): Promise<BatchControllerResponse> {
      const batch = await requireActiveBatch(options.store, user.telegramUserId);
      const updated = startProcessing(batch);
      await options.store.saveBatch(updated);

      return {
        text: [renderBatchPanel(updated), "", "Trabalho enviado para a fila. O processamento continua no servidor."].join("\n"),
        keyboard: null,
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
    fileId: video.fileId,
    fileName: video.fileName,
    sizeBytes: video.sizeBytes ?? 0
  };
}
