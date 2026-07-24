import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import { validateTemplates } from "../../src/templates/validateTemplates.js";

const tmpRoots: string[] = [];

describe("validateTemplates", () => {
  afterEach(async () => {
    await Promise.all(tmpRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  it("accepts a valid frame template with matching PNG dimensions and key color coverage", async () => {
    const rootDir = await createTemplateFixture("valid-template", {
      canvas: { width: 4, height: 4 },
      videoBox: { x: 0, y: 2, width: 4, height: 2 },
      png: createRgbaPng(4, 4, (x, y) => (y >= 2 ? [0, 255, 1, 255] : [255, 255, 255, 255]))
    });

    const result = await validateTemplates({ rootDir });

    expect(result).toEqual({
      templatesChecked: 1,
      smokeChecked: 0,
      issues: []
    });
  });

  it("rejects a videoBox that leaves the canvas", async () => {
    const rootDir = await createTemplateFixture("bad-video-box", {
      canvas: { width: 4, height: 4 },
      videoBox: { x: 3, y: 2, width: 2, height: 2 },
      png: createRgbaPng(4, 4, () => [0, 255, 1, 255])
    });

    const result = await validateTemplates({ rootDir });

    expect(result.issues).toContainEqual({
      templateId: "bad-video-box",
      message: "videoBox must fit inside canvas 4x4"
    });
  });

  it("rejects PNG assets with dimensions different from the template canvas", async () => {
    const rootDir = await createTemplateFixture("bad-dimensions", {
      canvas: { width: 4, height: 4 },
      videoBox: { x: 0, y: 0, width: 4, height: 4 },
      png: createRgbaPng(2, 2, () => [0, 255, 1, 255])
    });

    const result = await validateTemplates({ rootDir });

    expect(result.issues).toEqual(
      expect.arrayContaining([
        {
          templateId: "bad-dimensions",
          filePath: "tests/.tmp/templates/bad-dimensions/bad-dimensions/frame.png",
          message: "previewPath must be 4x4, got 2x2"
        },
        {
          templateId: "bad-dimensions",
          filePath: "tests/.tmp/templates/bad-dimensions/bad-dimensions/frame.png",
          message: "framePath must be 4x4, got 2x2"
        }
      ])
    );
  });

  it("rejects frame templates without enough key color coverage", async () => {
    const rootDir = await createTemplateFixture("missing-key-color", {
      canvas: { width: 4, height: 4 },
      videoBox: { x: 0, y: 0, width: 4, height: 4 },
      png: createRgbaPng(4, 4, () => [255, 255, 255, 255])
    });

    const result = await validateTemplates({ rootDir });

    expect(result.issues).toEqual(
      expect.arrayContaining([
        {
          templateId: "missing-key-color",
          filePath: "tests/.tmp/templates/missing-key-color/missing-key-color/frame.png",
          message: "keyColor #00FF01 covers 0 pixels; expected at least 1"
        }
      ])
    );
  });
});

async function createTemplateFixture(
  id: string,
  input: {
    canvas: { width: number; height: number };
    videoBox: { x: number; y: number; width: number; height: number };
    png: Buffer;
  }
) {
  const rootDir = join(process.cwd(), "tests", ".tmp", "templates", id);
  const templateDir = join(rootDir, id);
  const framePath = join("tests", ".tmp", "templates", id, id, "frame.png");
  tmpRoots.push(rootDir);

  await mkdir(templateDir, { recursive: true });
  await writeFile(join(templateDir, "frame.png"), input.png);
  await writeFile(
    join(templateDir, "template.json"),
    JSON.stringify(
      {
        id,
        name: id,
        kind: "frame",
        previewPath: framePath,
        framePath,
        canvas: input.canvas,
        videoBox: input.videoBox,
        keyColor: "#00FF01"
      },
      null,
      2
    )
  );

  return rootDir;
}

function createRgbaPng(
  width: number,
  height: number,
  pixel: (x: number, y: number) => [red: number, green: number, blue: number, alpha: number]
) {
  const rows: number[] = [];

  for (let y = 0; y < height; y += 1) {
    rows.push(0);
    for (let x = 0; x < width; x += 1) {
      rows.push(...pixel(x, y));
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", Buffer.concat([uint32(width), uint32(height), Buffer.from([8, 6, 0, 0, 0])])),
    pngChunk("IDAT", deflateSync(Buffer.from(rows))),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function pngChunk(type: string, data: Buffer) {
  return Buffer.concat([uint32(data.length), Buffer.from(type, "ascii"), data, Buffer.alloc(4)]);
}

function uint32(value: number) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value);
  return buffer;
}
