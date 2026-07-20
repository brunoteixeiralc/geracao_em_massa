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

export async function processQueuedBatch(options: {
  batchId: string;
  store: WorkerBatchStore;
  downloader: WorkerDownloader;
  renderer: WorkerRenderer;
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
  await options.store.saveBatch(currentBatch);

  for (const video of currentBatch.videos) {
    currentBatch = updateVideo(currentBatch, video.id, { status: "downloading" });
    await options.store.saveBatch(currentBatch);

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
      await options.store.saveBatch(currentBatch);
    } catch (error) {
      currentBatch = {
        ...updateVideo(currentBatch, video.id, { status: "failed" }),
        status: "failed"
      };
      await options.store.saveBatch(currentBatch);
      throw error;
    }
  }

  currentBatch = { ...currentBatch, status: "validating" };
  await options.store.saveBatch(currentBatch);

  currentBatch = { ...currentBatch, status: "rendering" };
  await options.store.saveBatch(currentBatch);

  for (const video of currentBatch.videos) {
    if (!video.inputPath) {
      currentBatch = updateVideo(currentBatch, video.id, { status: "failed" });
      await options.store.saveBatch(currentBatch);
      continue;
    }

    currentBatch = updateVideo(currentBatch, video.id, { status: "rendering" });
    await options.store.saveBatch(currentBatch);

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
      await options.store.saveBatch(currentBatch);
    } catch {
      currentBatch = updateVideo(currentBatch, video.id, { status: "failed" });
      await options.store.saveBatch(currentBatch);
    }
  }

  if (currentBatch.videos.every((video) => video.status === "failed")) {
    currentBatch = { ...currentBatch, status: "failed" };
    await options.store.saveBatch(currentBatch);
    return currentBatch;
  }

  currentBatch = { ...currentBatch, status: "zipping" };
  await options.store.saveBatch(currentBatch);

  return currentBatch;
}

function updateVideo(batch: Batch, videoId: string, patch: Partial<Batch["videos"][number]>): Batch {
  return {
    ...batch,
    videos: batch.videos.map((video) => (video.id === videoId ? { ...video, ...patch } : video))
  };
}
