import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { nanoid } from "nanoid";
import { describe, expect, it } from "vitest";
import { createTelegramDelivery } from "../../src/delivery/telegramDelivery.js";

describe("createTelegramDelivery", () => {
  it("sends ready videos under the size limit and always sends the zip link", async () => {
    const workDir = join(process.cwd(), ".data", "test", `reels-delivery-${nanoid()}`);
    await mkdir(workDir, { recursive: true });
    const smallVideoPath = join(workDir, "small.mp4");
    const largeVideoPath = join(workDir, "large.mp4");
    await writeFile(smallVideoPath, Buffer.alloc(10));
    await writeFile(largeVideoPath, Buffer.alloc(20));
    const calls: Array<{ url: string; body: unknown }> = [];
    const delivery = createTelegramDelivery({
      botToken: "123456:test-token",
      maxTelegramSendBytes: 12,
      fetch: async (url, init) => {
        calls.push({ url: url.toString(), body: JSON.parse(String(init?.body)) });
        return { ok: true } as Response;
      }
    });

    await delivery.deliverBatch({
      chatId: "123",
      zipUrl: "https://files.example.com/batches/batch-1/batch-1.zip",
      videos: [
        {
          id: "video-1",
          fileName: "one.mp4",
          outputPath: smallVideoPath,
          outputUrl: "https://files.example.com/batches/batch-1/video-1.mp4"
        },
        {
          id: "video-2",
          fileName: "two.mp4",
          outputPath: largeVideoPath,
          outputUrl: "https://files.example.com/batches/batch-1/video-2.mp4"
        }
      ]
    });

    expect(calls.map((call) => call.url)).toEqual([
      "https://api.telegram.org/bot123456:test-token/sendVideo",
      "https://api.telegram.org/bot123456:test-token/sendMessage"
    ]);
    expect(calls[0].body).toMatchObject({
      chat_id: "123",
      video: "https://files.example.com/batches/batch-1/video-1.mp4",
      caption: "one.mp4"
    });
    expect(calls[1].body).toMatchObject({
      chat_id: "123",
      text: "ZIP do lote pronto: https://files.example.com/batches/batch-1/batch-1.zip"
    });
  });

  it("fails visibly when Telegram rejects a delivery call", async () => {
    const delivery = createTelegramDelivery({
      botToken: "123456:test-token",
      maxTelegramSendBytes: 12,
      fetch: async () => ({ ok: false, status: 429, text: async () => "rate limited" }) as Response
    });

    await expect(
      delivery.deliverBatch({
        chatId: "123",
        zipUrl: "https://files.example.com/batch.zip",
        videos: []
      })
    ).rejects.toThrow("Telegram delivery failed with status 429: rate limited");
  });
});
