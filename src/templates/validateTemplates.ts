import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { buildAntiduplicationVariant } from "../renderer/antiduplication.js";
import { buildFfmpegArgs } from "../renderer/ffmpegPlan.js";
import { DEFAULT_BATCH_SETTINGS } from "../workflow/settings.js";
import { countPngRgbPixels, readPngInfo } from "./png.js";
import { loadTemplatesFromDirectory, type TemplateDefinition } from "./templates.js";

export type TemplateValidationIssue = {
  templateId?: string;
  filePath?: string;
  message: string;
};

export type TemplateValidationResult = {
  templatesChecked: number;
  smokeChecked: number;
  issues: TemplateValidationIssue[];
};

export type TemplateValidationOptions = {
  rootDir?: string;
  smoke?: boolean;
  ffmpegPath?: string;
  workDir?: string;
};

const defaultTemplateRoot = join(process.cwd(), "assets", "templates");
const minimumKeyColorCoverage = 0.01;

export async function validateTemplates(options: TemplateValidationOptions = {}): Promise<TemplateValidationResult> {
  const rootDir = options.rootDir ?? defaultTemplateRoot;
  const issues: TemplateValidationIssue[] = [];
  let templates: TemplateDefinition[];

  try {
    templates = loadTemplatesFromDirectory(rootDir);
  } catch (error) {
    return {
      templatesChecked: 0,
      smokeChecked: 0,
      issues: [{ message: error instanceof Error ? error.message : "Could not load templates" }]
    };
  }

  for (const template of templates) {
    issues.push(...validateTemplate(template));
  }

  const smokeChecked = options.smoke && issues.length === 0 ? await runSmokeChecks(templates, options, issues) : 0;

  return {
    templatesChecked: templates.length,
    smokeChecked,
    issues
  };
}

function validateTemplate(template: TemplateDefinition): TemplateValidationIssue[] {
  const issues: TemplateValidationIssue[] = [];
  const videoBoxRight = template.videoBox.x + template.videoBox.width;
  const videoBoxBottom = template.videoBox.y + template.videoBox.height;

  if (videoBoxRight > template.canvas.width || videoBoxBottom > template.canvas.height) {
    issues.push({
      templateId: template.id,
      message: `videoBox must fit inside canvas ${template.canvas.width}x${template.canvas.height}`
    });
  }

  issues.push(...validatePngDimensions(template, template.previewPath, "previewPath"));

  if (template.kind === "frame") {
    issues.push(...validatePngDimensions(template, template.framePath, "framePath"));

    if (template.keyColor) {
      issues.push(...validateKeyColorCoverage(template));
    }
  }

  return issues;
}

function validatePngDimensions(template: TemplateDefinition, assetPath: string, fieldName: string): TemplateValidationIssue[] {
  const filePath = resolve(process.cwd(), assetPath);

  try {
    const info = readPngInfo(filePath);
    const dimensionsMatch = info.width === template.canvas.width && info.height === template.canvas.height;

    if (!dimensionsMatch) {
      return [
        {
          templateId: template.id,
          filePath: assetPath,
          message: `${fieldName} must be ${template.canvas.width}x${template.canvas.height}, got ${info.width}x${info.height}`
        }
      ];
    }
  } catch (error) {
    return [
      {
        templateId: template.id,
        filePath: assetPath,
        message: `${fieldName} must be a readable PNG: ${error instanceof Error ? error.message : "unknown error"}`
      }
    ];
  }

  return [];
}

function validateKeyColorCoverage(template: Extract<TemplateDefinition, { kind: "frame" }>): TemplateValidationIssue[] {
  const color = hexToRgb(template.keyColor);
  if (!color) {
    return [];
  }

  try {
    const keyColorPixels = countPngRgbPixels(resolve(process.cwd(), template.framePath), color);
    const videoBoxPixels = template.videoBox.width * template.videoBox.height;
    const minimumPixels = Math.max(1, Math.floor(videoBoxPixels * minimumKeyColorCoverage));

    if (keyColorPixels < minimumPixels) {
      return [
        {
          templateId: template.id,
          filePath: template.framePath,
          message: `keyColor ${template.keyColor} covers ${keyColorPixels} pixels; expected at least ${minimumPixels}`
        }
      ];
    }
  } catch (error) {
    return [
      {
        templateId: template.id,
        filePath: template.framePath,
        message: `keyColor could not be inspected: ${error instanceof Error ? error.message : "unknown error"}`
      }
    ];
  }

  return [];
}

async function runSmokeChecks(
  templates: TemplateDefinition[],
  options: TemplateValidationOptions,
  issues: TemplateValidationIssue[]
) {
  const workDir = options.workDir ?? (await mkdtemp(join(tmpdir(), "reels-template-smoke-")));
  const ffmpegPath = options.ffmpegPath ?? "ffmpeg";
  const inputPath = join(workDir, "input.mp4");
  let smokeChecked = 0;

  try {
    await runProcess(ffmpegPath, [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "testsrc2=size=720x1280:rate=30:duration=1",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=1000:duration=1",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      inputPath
    ]);

    for (const template of templates) {
      const outputPath = join(workDir, `${template.id}.mp4`);
      const args = buildFfmpegArgs({
        inputPath,
        outputPath,
        template,
        settings: DEFAULT_BATCH_SETTINGS,
        inputDurationSeconds: 1,
        antiduplicationVariant: buildAntiduplicationVariant(`template-smoke:${template.id}`)
      });

      try {
        await runProcess(ffmpegPath, args);
        smokeChecked += 1;
      } catch (error) {
        issues.push({
          templateId: template.id,
          message: `FFmpeg smoke failed: ${error instanceof Error ? error.message : "unknown error"}`
        });
      }
    }
  } catch (error) {
    issues.push({
      message: `Could not create FFmpeg smoke input: ${error instanceof Error ? error.message : "unknown error"}`
    });
  } finally {
    if (!options.workDir) {
      await rm(workDir, { recursive: true, force: true });
    }
  }

  return smokeChecked;
}

function runProcess(command: string, args: string[]) {
  return new Promise<void>((resolvePromise, reject) => {
    const childProcess = spawn(command, args);
    let stderr = "";

    childProcess.stderr?.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    childProcess.once("error", reject);
    childProcess.once("close", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      reject(new Error(stderr.trim() || `process exited with code ${code}`));
    });
  });
}

function hexToRgb(hexColor: string | undefined) {
  if (!hexColor) {
    return undefined;
  }

  const match = /^#(?<red>[0-9a-fA-F]{2})(?<green>[0-9a-fA-F]{2})(?<blue>[0-9a-fA-F]{2})$/.exec(hexColor);
  if (!match?.groups) {
    return undefined;
  }

  return {
    red: Number.parseInt(match.groups.red, 16),
    green: Number.parseInt(match.groups.green, 16),
    blue: Number.parseInt(match.groups.blue, 16)
  };
}
