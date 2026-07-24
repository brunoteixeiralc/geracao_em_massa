import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, extname, join, relative, resolve } from "node:path";
import { readPngInfo, findPngRgbBounds } from "./png.js";
import { loadTemplatesFromDirectory, type TemplateDefinition } from "./templates.js";

export type VideoBox = { x: number; y: number; width: number; height: number };

export type CreateFrameTemplateInput = {
  id: string;
  name: string;
  sourceFramePath: string;
  rootDir?: string;
  keyColor?: string;
  videoBox?: VideoBox;
};

export type CreatedFrameTemplate = {
  templateDir: string;
  templatePath: string;
  framePath: string;
  definition: Extract<TemplateDefinition, { kind: "frame" }>;
};

const defaultTemplateRoot = join(process.cwd(), "assets", "templates");
const defaultKeyColor = "#00FF01";
const templateIdPattern = /^[a-z0-9][a-z0-9-]*$/;

export function listTemplateSummaries(rootDir = defaultTemplateRoot) {
  return loadTemplatesFromDirectory(rootDir).map((template) => ({
    id: template.id,
    name: template.name,
    kind: template.kind,
    canvas: `${template.canvas.width}x${template.canvas.height}`,
    videoBox: `${template.videoBox.x},${template.videoBox.y},${template.videoBox.width},${template.videoBox.height}`
  }));
}

export async function createFrameTemplate(input: CreateFrameTemplateInput): Promise<CreatedFrameTemplate> {
  assertTemplateId(input.id);

  const rootDir = input.rootDir ?? defaultTemplateRoot;
  const templateDir = join(rootDir, input.id);
  const sourceFramePath = resolve(process.cwd(), input.sourceFramePath);
  const keyColor = input.keyColor ?? defaultKeyColor;

  if (!existsSync(sourceFramePath)) {
    throw new Error(`Frame image not found: ${input.sourceFramePath}`);
  }

  if (existsSync(templateDir)) {
    throw new Error(`Template already exists: ${templateDir}`);
  }

  const pngInfo = readPngInfo(sourceFramePath);
  const videoBox = input.videoBox ?? detectVideoBoxFromKeyColor(sourceFramePath, keyColor);
  assertVideoBoxInsideCanvas(videoBox, { width: pngInfo.width, height: pngInfo.height });

  const framePath = join(templateDir, "frame.png");
  const templatePath = join(templateDir, "template.json");
  const framePathInTemplate = toRepositoryRelativePath(framePath);
  const definition: Extract<TemplateDefinition, { kind: "frame" }> = {
    id: input.id,
    name: input.name,
    kind: "frame",
    previewPath: framePathInTemplate,
    framePath: framePathInTemplate,
    canvas: { width: pngInfo.width, height: pngInfo.height },
    videoBox,
    keyColor
  };

  await mkdir(templateDir, { recursive: true });
  await copyFile(sourceFramePath, framePath);
  await writeFile(templatePath, `${JSON.stringify(definition, null, 2)}\n`);

  return {
    templateDir,
    templatePath,
    framePath,
    definition
  };
}

export function parseVideoBox(value: string): VideoBox {
  const parts = value.split(",").map((part) => Number.parseInt(part.trim(), 10));

  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    throw new Error("videoBox must use x,y,width,height, for example 0,761,1080,1159");
  }

  const [x, y, width, height] = parts as [number, number, number, number];
  const videoBox = { x, y, width, height };
  assertPositiveVideoBox(videoBox);

  return videoBox;
}

export function parseHexColor(value: string) {
  if (!/^#[0-9a-fA-F]{6}$/.test(value)) {
    throw new Error("keyColor must be a hex color like #00FF01");
  }

  return value.toUpperCase();
}

function detectVideoBoxFromKeyColor(sourceFramePath: string, keyColor: string) {
  const rgb = hexToRgb(parseHexColor(keyColor));
  const bounds = findPngRgbBounds(sourceFramePath, rgb);

  if (!bounds) {
    throw new Error(
      `Could not detect videoBox automatically: keyColor ${keyColor} was not found. Pass --video-box x,y,width,height or export the frame with that color in the video area.`
    );
  }

  return bounds;
}

function assertTemplateId(id: string) {
  if (!templateIdPattern.test(id)) {
    throw new Error("Template id must use lowercase letters, numbers, and hyphens, for example humor-gato");
  }
}

function assertVideoBoxInsideCanvas(videoBox: VideoBox, canvas: { width: number; height: number }) {
  assertPositiveVideoBox(videoBox);

  if (videoBox.x + videoBox.width > canvas.width || videoBox.y + videoBox.height > canvas.height) {
    throw new Error(`videoBox must fit inside canvas ${canvas.width}x${canvas.height}`);
  }
}

function assertPositiveVideoBox(videoBox: VideoBox) {
  if (videoBox.x < 0 || videoBox.y < 0 || videoBox.width <= 0 || videoBox.height <= 0) {
    throw new Error("videoBox must have non-negative x/y and positive width/height");
  }
}

function toRepositoryRelativePath(path: string) {
  return relative(process.cwd(), path).split("\\").join("/");
}

function hexToRgb(hexColor: string) {
  return {
    red: Number.parseInt(hexColor.slice(1, 3), 16),
    green: Number.parseInt(hexColor.slice(3, 5), 16),
    blue: Number.parseInt(hexColor.slice(5, 7), 16)
  };
}

export function formatTemplateSummaryTable(templates: ReturnType<typeof listTemplateSummaries>) {
  if (templates.length === 0) {
    return "No templates found.";
  }

  const rows = [
    ["ID", "Kind", "Canvas", "Video Box", "Name"],
    ...templates.map((template) => [template.id, template.kind, template.canvas, template.videoBox, template.name])
  ];
  const widths = rows[0].map((_, index) => Math.max(...rows.map((row) => row[index].length)));

  return rows.map((row) => row.map((cell, index) => cell.padEnd(widths[index])).join("  ").trimEnd()).join("\n");
}

export function defaultTemplateNameFromId(id: string) {
  return id
    .split("-")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

export function defaultTemplateIdFromFramePath(path: string) {
  return basename(path, extname(path))
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
