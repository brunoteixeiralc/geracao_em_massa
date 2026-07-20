import type { Batch } from "../workflow/batchWorkflow.js";

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

export async function processQueuedBatch(options: {
  batchId: string;
  store: WorkerBatchStore;
  downloader: WorkerDownloader;
}) {
  const batch = await options.store.findBatchById(options.batchId);
  if (!batch) {
    throw new Error(`Batch ${options.batchId} not found`);
  }

  if (batch.status !== "queued") {
    throw new Error(`Cannot process batch while status is ${batch.status}`);
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

  return currentBatch;
}

function updateVideo(batch: Batch, videoId: string, patch: Partial<Batch["videos"][number]>): Batch {
  return {
    ...batch,
    videos: batch.videos.map((video) => (video.id === videoId ? { ...video, ...patch } : video))
  };
}
