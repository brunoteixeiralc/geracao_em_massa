const ACCEPTED_VIDEO_MIME_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);

export type MediaInput = {
  fileName: string;
  mimeType: string | undefined;
  sizeBytes: number | undefined;
  maxInputBytes: number;
};

export type MediaValidationResult = { ok: true } | { ok: false; reason: string };

export function validateMediaInput(input: MediaInput): MediaValidationResult {
  if (typeof input.sizeBytes === "number" && input.sizeBytes > input.maxInputBytes) {
    return { ok: false, reason: "Arquivo maior que 20 MB." };
  }

  if (!input.mimeType || !ACCEPTED_VIDEO_MIME_TYPES.has(input.mimeType)) {
    return { ok: false, reason: "Envie apenas videos MP4, MOV ou WEBM." };
  }

  return { ok: true };
}
