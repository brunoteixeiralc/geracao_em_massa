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
  const inputArgs = ["-i", input.inputPath];
  const canvasRate = settings.antiduplication ? ":r=30" : "";
  const filters = [
    `color=c=white:s=${template.canvas.width}x${template.canvas.height}${canvasRate}[canvas]`,
    `[0:v]${trimFilter},setpts=${speedSetPts(settings.speed)},scale=${scaledWidth}:${scaledHeight}:force_original_aspect_ratio=increase,crop=${template.videoBox.width}:${template.videoBox.height}`
  ];

  if (settings.mirror) {
    filters[1] += ",hflip";
  }

  if (settings.antiduplication) {
    filters[1] += ",fps=30,setsar=1";
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
    ...(settings.antiduplication ? ["-map_metadata", "-1", "-map_chapters", "-1"] : []),
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-threads",
    "1",
    "-x264-params",
    "threads=1:lookahead_threads=1:sliced_threads=0",
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

function toFfmpegColor(hexColor: string) {
  return `0x${hexColor.slice(1).toLowerCase()}`;
}
