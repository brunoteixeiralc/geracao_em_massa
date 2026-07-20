import { mkdir, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { nanoid } from "nanoid";
import { describe, expect, it } from "vitest";
import { createZipPackager } from "../../src/packager/zipPackager.js";

describe("createZipPackager", () => {
  it("creates a zip file with rendered videos", async () => {
    const workDir = join(process.cwd(), ".data", "test", `reels-zip-${nanoid()}`);
    const renderedDir = join(workDir, "batch-1", "rendered");
    await mkdir(renderedDir, { recursive: true });
    const firstPath = join(renderedDir, "a.mp4");
    const secondPath = join(renderedDir, "b.mp4");
    await writeFile(firstPath, "video-a");
    await writeFile(secondPath, "video-b");

    const packager = createZipPackager({ workDir, createZipId: () => "zip-123" });

    const result = await packager.createBatchZip({
      batchId: "batch-1",
      videos: [
        { id: "video-1", outputPath: firstPath },
        { id: "video-2", outputPath: secondPath }
      ]
    });

    expect(result).toEqual({
      zipPath: resolve(workDir, "archives", "zip-123.zip"),
      fileName: "batch-1.zip"
    });
    expect((await stat(result.zipPath)).size).toBeGreaterThan(0);
  });

  it("rejects videos without rendered output paths", async () => {
    const packager = createZipPackager({ workDir: join(process.cwd(), ".data", "test", `reels-zip-${nanoid()}`) });

    await expect(
      packager.createBatchZip({
        batchId: "batch-1",
        videos: [{ id: "video-1", outputPath: null }]
      })
    ).rejects.toThrow("Video video-1 has no rendered output path.");
  });
});
