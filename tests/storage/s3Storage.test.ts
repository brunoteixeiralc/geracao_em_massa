import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { nanoid } from "nanoid";
import { describe, expect, it } from "vitest";
import { createS3Storage } from "../../src/storage/s3Storage.js";

describe("createS3Storage", () => {
  it("uploads a local file and returns a public URL", async () => {
    const workDir = join(process.cwd(), ".data", "test", `reels-storage-${nanoid()}`);
    await mkdir(workDir, { recursive: true });
    const filePath = join(workDir, "clip.mp4");
    await writeFile(filePath, "video");
    const sentCommands: unknown[] = [];
    const storage = createS3Storage({
      bucket: "reels-output",
      publicAssetBaseUrl: "https://files.example.com/media",
      client: {
        send: async (command) => {
          sentCommands.push(command.input);
          return {};
        }
      }
    });

    const result = await storage.uploadFile({
      filePath,
      key: "batches/batch-1/video-1.mp4",
      contentType: "video/mp4"
    });

    expect(result).toEqual({
      key: "batches/batch-1/video-1.mp4",
      url: "https://files.example.com/media/batches/batch-1/video-1.mp4"
    });
    expect(sentCommands[0]).toMatchObject({
      Bucket: "reels-output",
      Key: "batches/batch-1/video-1.mp4",
      ContentType: "video/mp4"
    });
  });

  it("rejects unsafe storage keys", async () => {
    const storage = createS3Storage({
      bucket: "reels-output",
      publicAssetBaseUrl: "https://files.example.com",
      client: {
        send: async () => ({})
      }
    });

    await expect(
      storage.uploadFile({
        filePath: "/tmp/clip.mp4",
        key: "../clip.mp4",
        contentType: "video/mp4"
      })
    ).rejects.toThrow("Storage key invalida.");
  });
});
