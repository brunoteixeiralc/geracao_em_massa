import { describe, expect, it, vi } from "vitest";
import { createBatchQueue } from "../../src/queue/batchQueue.js";

describe("createBatchQueue", () => {
  it("enqueues a batch processing job with safe retry defaults", async () => {
    const add = vi.fn();
    const queue = createBatchQueue({ add } as never);

    await queue.enqueueBatch("batch-1");

    expect(add).toHaveBeenCalledWith(
      "process-batch",
      { batchId: "batch-1" },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 500
      }
    );
  });
});
