import { Queue } from "bullmq";
import { Redis } from "ioredis";

export const BATCH_QUEUE_NAME = "reels-batches";
export const PROCESS_BATCH_JOB = "process-batch";

export type BatchJobData = {
  batchId: string;
};

export type QueueLike = {
  add(name: string, data: BatchJobData, options: Record<string, unknown>): Promise<unknown>;
};

export function createRedisConnection(redisUrl: string) {
  return new Redis(redisUrl, {
    maxRetriesPerRequest: null
  });
}

export function createBullMqBatchQueue(redisUrl: string) {
  return new Queue<BatchJobData>(BATCH_QUEUE_NAME, {
    connection: createRedisConnection(redisUrl)
  });
}

export function createBatchQueue(queue: QueueLike) {
  return {
    async enqueueBatch(batchId: string) {
      await queue.add(
        PROCESS_BATCH_JOB,
        { batchId },
        {
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 500
        }
      );
    }
  };
}
