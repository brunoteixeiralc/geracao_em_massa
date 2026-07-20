import { Worker } from "bullmq";
import { BATCH_QUEUE_NAME, PROCESS_BATCH_JOB, createRedisConnection, type BatchJobData } from "../queue/batchQueue.js";
import {
  processQueuedBatch,
  type WorkerBatchStore,
  type WorkerDelivery,
  type WorkerDownloader,
  type WorkerPackager,
  type WorkerRenderer,
  type WorkerStorage
} from "./processBatch.js";

export type WorkerHandle = {
  close(): Promise<unknown>;
};

export type WorkerFactory = (
  name: string,
  processor: (job: { name: string; data: BatchJobData }) => Promise<unknown>,
  options: Record<string, unknown>
) => WorkerHandle;

export function createBatchWorker(options: {
  redisUrl: string;
  concurrency: number;
  store: WorkerBatchStore;
  downloader: WorkerDownloader;
  renderer: WorkerRenderer;
  packager: WorkerPackager;
  storage: WorkerStorage;
  delivery: WorkerDelivery;
  createWorker?: WorkerFactory;
}) {
  const workerFactory = options.createWorker ?? createDefaultWorker(options.redisUrl);

  return workerFactory(
    BATCH_QUEUE_NAME,
    async (job) => {
      if (job.name !== PROCESS_BATCH_JOB) {
        throw new Error(`Unknown job ${job.name}`);
      }

      return processQueuedBatch({
        batchId: job.data.batchId,
        store: options.store,
        downloader: options.downloader,
        renderer: options.renderer,
        packager: options.packager,
        storage: options.storage,
        delivery: options.delivery
      });
    },
    {
      concurrency: options.concurrency
    }
  );
}

function createDefaultWorker(redisUrl: string): WorkerFactory {
  return (name, processor, options) =>
    new Worker<BatchJobData>(name, processor, {
      ...options,
      connection: createRedisConnection(redisUrl)
    });
}
