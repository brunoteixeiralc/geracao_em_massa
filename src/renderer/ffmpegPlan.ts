import type { TemplateDefinition } from "../templates/templates.js";
import type { BatchSettings } from "../workflow/settings.js";

export type FfmpegPlanInput = {
  inputPath: string;
  outputPath: string;
  template: TemplateDefinition;
  settings: BatchSettings;
  inputDurationSeconds?: number;
};

export function buildFfmpegArgs(input: FfmpegPlanInput): string[] {
  const { template, settings } = input;
  const scaleFactor = settings.zoomPercent / 100;
  const scaledWidth = Math.round(template.videoBox.width * scaleFactor);
  const scaledHeight = Math.round(template.videoBox.height * scaleFactor);
  const trimEnd = input.inputDurationSeconds ? input.inputDurationSeconds - settings.trimEndSeconds : undefined;
  const trimFilter = trimEnd && trimEnd > settings.trimStartSeconds
    ? `trim=start=${settings.trimStartSeconds}:end=${roundOneDecimal(trimEnd)}`
    : `trim=start=${settings.trimStartSeconds}`;
  const filters = [
    `[0:v]${trimFilter},setpts=${speedSetPts(settings.speed)},scale=${scaledWidth}:${scaledHeight}:force_original_aspect_ratio=increase,crop=${template.videoBox.width}:${template.videoBox.height}`
  ];

  if (settings.mirror) {
    filters[0] += ",hflip";
  }

  filters[0] += "[video]";

  return [
    "-y",
    "-i",
    input.inputPath,
    "-filter_complex",
    filters.join(";"),
    "-map",
    "[video]",
    "-map",
    "0:a?",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    "-shortest",
    input.outputPath
  ];
}

function speedSetPts(speed: number) {
  return `${(1 / speed).toFixed(4)}*PTS`;
}

function roundOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}
