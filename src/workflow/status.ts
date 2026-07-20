export const BATCH_STATUSES = [
  "draft",
  "receiving",
  "settings",
  "queued",
  "downloading",
  "validating",
  "rendering",
  "zipping",
  "uploading",
  "delivering",
  "completed",
  "failed",
  "cancelled"
] as const;

export type BatchStatus = (typeof BATCH_STATUSES)[number];

export const VIDEO_STATUSES = ["received", "queued", "downloading", "rendering", "ready", "delivered", "failed"] as const;

export type VideoStatus = (typeof VIDEO_STATUSES)[number];
