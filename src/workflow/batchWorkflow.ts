import { type BatchSettings, DEFAULT_BATCH_SETTINGS } from "./settings.js";
import type { BatchStatus, VideoStatus } from "./status.js";

export type BatchVideo = {
  id: string;
  fileId: string;
  fileName: string;
  sizeBytes: number;
  status: VideoStatus;
  inputPath?: string | null;
  outputPath?: string | null;
  outputUrl?: string | null;
};

export type Batch = {
  id: string;
  telegramUserId: string;
  status: BatchStatus;
  templateId: string | null;
  statusPanelChatId?: string | null;
  statusPanelMessageId?: number | null;
  outputZipUrl?: string | null;
  settings: BatchSettings;
  videos: BatchVideo[];
};

export function createDraftBatch(input: { id: string; telegramUserId: string }): Batch {
  return {
    id: input.id,
    telegramUserId: input.telegramUserId,
    status: "draft",
    templateId: null,
    statusPanelChatId: null,
    statusPanelMessageId: null,
    outputZipUrl: null,
    settings: DEFAULT_BATCH_SETTINGS,
    videos: []
  };
}

export function selectTemplate(batch: Batch, templateId: string): Batch {
  if (batch.status !== "draft") {
    throw new Error(`Cannot select template while batch is ${batch.status}`);
  }

  return { ...batch, templateId, status: "receiving" };
}

export function receiveVideo(batch: Batch, video: Omit<BatchVideo, "status">, maxBatchVideos: number): Batch {
  if (batch.status !== "receiving") {
    throw new Error(`Cannot receive video while batch is ${batch.status}`);
  }

  if (batch.videos.length >= maxBatchVideos) {
    throw new Error("Batch video limit reached");
  }

  return {
    ...batch,
    videos: [...batch.videos, { ...video, status: "received" }]
  };
}

export function openSettings(batch: Batch): Batch {
  if (batch.status !== "receiving") {
    throw new Error(`Cannot open settings while batch is ${batch.status}`);
  }

  if (batch.videos.length === 0) {
    throw new Error("Cannot process an empty batch");
  }

  return { ...batch, status: "settings" };
}

export function startProcessing(batch: Batch): Batch {
  const settingsBatch = batch.status === "settings" ? batch : openSettings(batch);

  return {
    ...settingsBatch,
    status: "queued",
    videos: settingsBatch.videos.map((video) => ({ ...video, status: "queued" }))
  };
}
