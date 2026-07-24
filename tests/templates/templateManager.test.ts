import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import {
  createFrameTemplate,
  defaultTemplateIdFromFramePath,
  formatTemplateSummaryTable,
  listTemplateSummaries,
  parseVideoBox
} from "../../src/templates/templateManager.js";

const tmpRoots: string[] = [];

describe("template manager", () => {
  afterEach(async () => {
    await Promise.all(tmpRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  it("creates a frame template and detects videoBox from key color", async () => {
    const rootDir = await createTmpRoot("auto-video-box");
    const sourceFramePath = join(rootDir, "source.png");
    await writeFile(
      sourceFramePath,
      createRgbaPng(6, 8, (x, y) => (x >= 1 && x <= 4 && y >= 3 && y <= 6 ? [0, 255, 1, 255] : [255, 255, 255, 255]))
    );

    const created = await createFrameTemplate({
      id: "humor-gato",
      name: "Humor Gato",
      sourceFramePath,
      rootDir: join(rootDir, "templates")
    });

    expect(created.definition).toMatchObject({
      id: "humor-gato",
      name: "Humor Gato",
      kind: "frame",
      canvas: { width: 6, height: 8 },
      videoBox: { x: 1, y: 3, width: 4, height: 4 },
      keyColor: "#00FF01"
    });

    const templateJson = JSON.parse(await readFile(created.templatePath, "utf8")) as typeof created.definition;
    expect(templateJson.framePath).toContain("tests/.tmp/template-manager/auto-video-box/templates/humor-gato/frame.png");
    expect(listTemplateSummaries(join(rootDir, "templates"))).toEqual([
      {
        id: "humor-gato",
        name: "Humor Gato",
        kind: "frame",
        canvas: "6x8",
        videoBox: "1,3,4,4"
      }
    ]);
  });

  it("accepts an explicit videoBox when the key color is not present", async () => {
    const rootDir = await createTmpRoot("explicit-video-box");
    const sourceFramePath = join(rootDir, "source.png");
    await writeFile(sourceFramePath, createRgbaPng(6, 8, () => [255, 255, 255, 255]));

    const created = await createFrameTemplate({
      id: "humor-passaro",
      name: "Humor Passaro",
      sourceFramePath,
      rootDir: join(rootDir, "templates"),
      videoBox: { x: 0, y: 2, width: 6, height: 5 }
    });

    expect(created.definition.videoBox).toEqual({ x: 0, y: 2, width: 6, height: 5 });
  });

  it("formats the template list for CLI output", () => {
    expect(
      formatTemplateSummaryTable([
        {
          id: "humor-gato",
          name: "Humor Gato",
          kind: "frame",
          canvas: "1080x1920",
          videoBox: "0,761,1080,1159"
        }
      ])
    ).toContain("humor-gato  frame");
  });

  it("parses helper values for CLI input", () => {
    expect(parseVideoBox("0,761,1080,1159")).toEqual({ x: 0, y: 761, width: 1080, height: 1159 });
    expect(defaultTemplateIdFromFramePath("/tmp/Copia de Humor de Gato.PNG")).toBe("copia-de-humor-de-gato");
  });
});

async function createTmpRoot(id: string) {
  const rootDir = join(process.cwd(), "tests", ".tmp", "template-manager", id);
  tmpRoots.push(rootDir);
  await mkdir(rootDir, { recursive: true });
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
