import type { Batch } from "../workflow/batchWorkflow.js";
import { getTemplateById } from "../templates/templates.js";

export type WorkerBatchStore = {
  findBatchById(batchId: string): Promise<Batch | null>;
  saveBatch(batch: Batch): Promise<void>;
};

export type WorkerDownloader = {
  downloadVideo(input: {
    batchId: string;
    videoId: string;
    fileId: string;
    fileName: string;
  }): Promise<{
    inputPath: string;
    bytesWritten: number;
  }>;
};

export type WorkerRenderer = {
  renderVideo(input: {
    batchId: string;
    videoId: string;
    inputPath: string;
    template: NonNullable<ReturnType<typeof getTemplateById>>;
    settings: Batch["settings"];
  }): Promise<{
    outputPath: string;
  }>;
};

export type WorkerPackager = {
  createBatchZip(input: {
    batchId: string;
    videos: Array<{
      id: string;
      outputPath?: string | null;
    }>;
  }): Promise<{
    zipPath: string;
    fileName: string;
  }>;
};

export type WorkerStorage = {
  uploadFile(input: {
    filePath: string;
    key: string;
    contentType: string;
  }): Promise<{
    key: string;
    url: string;
  }>;
};

export type WorkerDelivery = {
  deliverBatch(input: {
    chatId: string;
    zipUrl: string;
    videos: Array<{
      id: string;
      fileName: string;
      outputPath?: string | null;
      outputUrl?: string | null;
    }>;
  }): Promise<void>;
};

export type WorkerStatusNotifier = {
  updateBatchStatus(batch: Batch): Promise<void>;
};

export async function processQueuedBatch(options: {
  batchId: string;
  store: WorkerBatchStore;
  downloader: WorkerDownloader;
  renderer: WorkerRenderer;
  packager: WorkerPackager;
  storage: WorkerStorage;
  delivery: WorkerDelivery;
  statusNotifier?: WorkerStatusNotifier;
}) {
  const batch = await options.store.findBatchById(options.batchId);
  if (!batch) {
    throw new Error(`Batch ${options.batchId} not found`);
  }

  if (batch.status !== "queued") {
    throw new Error(`Cannot process batch while status is ${batch.status}`);
  }

  const template = batch.templateId ? getTemplateById(batch.templateId) : undefined;
  if (!template) {
    throw new Error("Batch template not found");
  }

  let currentBatch: Batch = {
    ...batch,
    status: "downloading",
    videos: batch.videos.map((video) => ({ ...video, status: "queued" }))
  };
  await saveBatchProgress(options, currentBatch);

  for (const video of currentBatch.videos) {
    currentBatch = updateVideo(currentBatch, video.id, { status: "downloading" });
    await saveBatchProgress(options, currentBatch);

    try {
      const download = await options.downloader.downloadVideo({
        batchId: currentBatch.id,
        videoId: video.id,
        fileId: video.fileId,
        fileName: video.fileName
      });

      currentBatch = updateVideo(currentBatch, video.id, {
        status: "queued",
        inputPath: download.inputPath
      });
      await saveBatchProgress(options, currentBatch);
    } catch (error) {
      currentBatch = {
        ...updateVideo(currentBatch, video.id, { status: "failed" }),
        status: "failed"
      };
      await saveBatchProgress(options, currentBatch);
      throw error;
    }
  }

  currentBatch = { ...currentBatch, status: "validating" };
  await saveBatchProgress(options, currentBatch);

  currentBatch = { ...currentBatch, status: "rendering" };
  await saveBatchProgress(options, currentBatch);

  for (const video of currentBatch.videos) {
    if (!video.inputPath) {
      currentBatch = updateVideo(currentBatch, video.id, { status: "failed" });
      await saveBatchProgress(options, currentBatch);
      continue;
    }

    currentBatch = updateVideo(currentBatch, video.id, { status: "rendering" });
    await saveBatchProgress(options, currentBatch);

    try {
      const render = await options.renderer.renderVideo({
        batchId: currentBatch.id,
        videoId: video.id,
        inputPath: video.inputPath,
        template,
        settings: currentBatch.settings
      });

      currentBatch = updateVideo(currentBatch, video.id, {
        status: "ready",
        outputPath: render.outputPath
      });
      await saveBatchProgress(options, currentBatch);
    } catch {
      currentBatch = updateVideo(currentBatch, video.id, { status: "failed" });
      await saveBatchProgress(options, currentBatch);
    }
  }

  if (currentBatch.videos.every((video) => video.status === "failed")) {
    currentBatch = { ...currentBatch, status: "failed" };
    await saveBatchProgress(options, currentBatch);
    return currentBatch;
  }

  currentBatch = { ...currentBatch, status: "zipping" };
  await saveBatchProgress(options, currentBatch);

  const readyVideos = currentBatch.videos.filter((video) => video.status === "ready");
  const zip = await options.packager.createBatchZip({
    batchId: currentBatch.id,
    videos: readyVideos
  });

  try {
    currentBatch = { ...currentBatch, status: "uploading" };
    await saveBatchProgress(options, currentBatch);

    for (const video of readyVideos) {
      if (!video.outputPath) {
        continue;
      }

      const upload = await options.storage.uploadFile({
        filePath: video.outputPath,
        key: `batches/${sanitizeStorageSegment(currentBatch.id)}/videos/${sanitizeStorageSegment(video.id)}.mp4`,
        contentType: "video/mp4"
      });

      currentBatch = updateVideo(currentBatch, video.id, { outputUrl: upload.url });
      await saveBatchProgress(options, currentBatch);
    }

    const zipUpload = await options.storage.uploadFile({
      filePath: zip.zipPath,
      key: `batches/${sanitizeStorageSegment(currentBatch.id)}/${sanitizeStorageSegment(zip.fileName)}`,
      contentType: "application/zip"
    });

    currentBatch = {
      ...currentBatch,
      outputZipUrl: zipUpload.url,
      status: "delivering"
    };
    await saveBatchProgress(options, currentBatch);

    await options.delivery.deliverBatch({
      chatId: currentBatch.telegramUserId,
      zipUrl: zipUpload.url,
      videos: currentBatch.videos
    });

    currentBatch = {
      ...currentBatch,
      status: "completed",
      videos: currentBatch.videos.map((video) => (video.status === "ready" ? { ...video, status: "delivered" } : video))
    };
    await saveBatchProgress(options, currentBatch);
  } catch (error) {
    currentBatch = { ...currentBatch, status: "failed" };
    await saveBatchProgress(options, currentBatch);
    throw error;
  }

  return currentBatch;
}

async function saveBatchProgress(
  options: {
    store: WorkerBatchStore;
    statusNotifier?: WorkerStatusNotifier;
  },
  batch: Batch
) {
  await options.store.saveBatch(batch);

  try {
    await options.statusNotifier?.updateBatchStatus(batch);
  } catch (error) {
    console.warn("Status panel update failed", error);
  }
}

function updateVideo(batch: Batch, videoId: string, patch: Partial<Batch["videos"][number]>): Batch {
  return {
    ...batch,
    videos: batch.videos.map((video) => (video.id === videoId ? { ...video, ...patch } : video))
  };
}

function sanitizeStorageSegment(value: string) {
  const safeValue = value.replace(/[^a-zA-Z0-9_.-]+/g, "-").replace(/^-+|-+$/g, "");
  return safeValue || "file";
}
