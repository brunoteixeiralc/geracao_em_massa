export type BatchSettings = {
  autoCut: boolean;
  zoomPercent: number;
  speed: number;
  mirror: boolean;
  trimStartSeconds: number;
  trimEndSeconds: number;
  antiduplication: boolean;
  cta: boolean;
  watermark: boolean;
};

export const DEFAULT_BATCH_SETTINGS: BatchSettings = {
  autoCut: true,
  zoomPercent: 105,
  speed: 1,
  mirror: false,
  trimStartSeconds: 0.3,
  trimEndSeconds: 0.3,
  antiduplication: true,
  cta: true,
  watermark: false
};

export type SettingAction =
  | { type: "zoom_delta"; delta: number }
  | { type: "speed_delta"; delta: number }
  | { type: "trim_start_delta"; delta: number }
  | { type: "trim_end_delta"; delta: number }
  | { type: "toggle_mirror" }
  | { type: "toggle_auto_cut" }
  | { type: "toggle_antiduplication" }
  | { type: "toggle_cta" }
  | { type: "toggle_watermark" };

export function updateSetting(settings: BatchSettings, action: SettingAction): BatchSettings {
  switch (action.type) {
    case "zoom_delta":
      return { ...settings, zoomPercent: clamp(settings.zoomPercent + action.delta, 100, 130) };
    case "speed_delta":
      return { ...settings, speed: clamp(roundOneDecimal(settings.speed + action.delta), 0.8, 1.3) };
    case "trim_start_delta":
      return { ...settings, trimStartSeconds: clamp(roundOneDecimal(settings.trimStartSeconds + action.delta), 0, 2) };
    case "trim_end_delta":
      return { ...settings, trimEndSeconds: clamp(roundOneDecimal(settings.trimEndSeconds + action.delta), 0, 2) };
    case "toggle_mirror":
      return { ...settings, mirror: !settings.mirror };
    case "toggle_auto_cut":
      return { ...settings, autoCut: !settings.autoCut };
    case "toggle_antiduplication":
      return { ...settings, antiduplication: !settings.antiduplication };
    case "toggle_cta":
      return { ...settings, cta: !settings.cta };
    case "toggle_watermark":
      return { ...settings, watermark: !settings.watermark };
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function roundOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}
