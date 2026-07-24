import type { TemplateDefinition } from "../templates/templates.js";
import type { BatchSettings } from "../workflow/settings.js";
import { buildAntiduplicationVariant, type AntiduplicationVariant } from "./antiduplication.js";

export type FfmpegPlanInput = {
  inputPath: string;
  outputPath: string;
  template: TemplateDefinition;
  settings: BatchSettings;
  inputDurationSeconds?: number;
  antiduplicationVariant?: AntiduplicationVariant;
};

export function buildFfmpegArgs(input: FfmpegPlanInput): string[] {
  const { template, settings } = input;
  const antiduplicationVariant = settings.antiduplication
    ? input.antiduplicationVariant ?? buildAntiduplicationVariant(`${input.inputPath}:${input.outputPath}`)
    : undefined;
  const scaleFactor = settings.zoomPercent / 100;
  const scaledWidth = Math.round(template.videoBox.width * scaleFactor);
  const scaledHeight = Math.round(template.videoBox.height * scaleFactor);
  const trimEnd = input.inputDurationSeconds ? input.inputDurationSeconds - settings.trimEndSeconds : undefined;
  const trimFilter = trimEnd && trimEnd > settings.trimStartSeconds
    ? `trim=start=${settings.trimStartSeconds}:end=${roundOneDecimal(trimEnd)}`
    : `trim=start=${settings.trimStartSeconds}`;
  const inputArgs = ["-i", input.inputPath];
  const canvasRate = settings.antiduplication ? ":r=30" : "";
  const filters = [
    `color=c=white:s=${template.canvas.width}x${template.canvas.height}${canvasRate}[canvas]`,
    `[0:v]${trimFilter},setpts=${speedSetPts(settings.speed)},scale=${scaledWidth}:${scaledHeight}:force_original_aspect_ratio=increase,crop=${template.videoBox.width}:${template.videoBox.height}`
  ];

  if (settings.mirror) {
    filters[1] += ",hflip";
  }

  if (antiduplicationVariant) {
    filters[1] += [
      ",fps=30",
      ",setsar=1",
      `,eq=brightness=${formatDecimal(antiduplicationVariant.brightness)}:contrast=${formatDecimal(
        antiduplicationVariant.contrast
      )}:saturation=${formatDecimal(antiduplicationVariant.saturation)}`,
      `,noise=alls=${antiduplicationVariant.noiseStrength}:allf=t+u:all_seed=${antiduplicationVariant.noiseSeed}`
    ].join("");
  }

  filters[1] += "[video]";
  filters.push(`[canvas][video]overlay=${template.videoBox.x}:${template.videoBox.y}:shortest=1[video_on_canvas]`);

  if (template.kind === "frame") {
    inputArgs.push("-loop", "1", "-i", template.framePath);
    const frameFilter = template.keyColor
      ? `[1:v]format=rgba,colorkey=${toFfmpegColor(template.keyColor)}:0.03:0.0[frame]`
      : "[1:v]format=rgba[frame]";
    filters.push(frameFilter);
    filters.push("[video_on_canvas][frame]overlay=0:0:shortest=1,format=yuv420p[composed]");
  } else {
    filters.push("[video_on_canvas]format=yuv420p[composed]");
  }

  return [
    "-y",
    ...inputArgs,
    "-filter_complex",
    filters.join(";"),
    "-map",
    "[composed]",
    "-map",
    "0:a?",
    ...(antiduplicationVariant
      ? ["-map_metadata", "-1", "-map_chapters", "-1", "-metadata", `comment=${antiduplicationVariant.metadataComment}`]
      : []),
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    antiduplicationVariant ? String(antiduplicationVariant.videoCrf) : "23",
    ...(antiduplicationVariant ? ["-g", String(antiduplicationVariant.gopSize), "-keyint_min", "30"] : []),
    ...(antiduplicationVariant
      ? [
          "-af",
          `volume=${formatDecimal(antiduplicationVariant.audioVolume)},highpass=f=20,lowpass=f=18000,aresample=48000`
        ]
      : []),
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

function formatDecimal(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(4);
}

function toFfmpegColor(hexColor: string) {
  return `0x${hexColor.slice(1).toLowerCase()}`;
}
