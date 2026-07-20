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
  | { type: "toggle_mirror" }
  | { type: "toggle_auto_cut" }
  | { type: "toggle_antiduplication" };

export function updateSetting(settings: BatchSettings, action: SettingAction): BatchSettings {
  switch (action.type) {
    case "zoom_delta":
      return { ...settings, zoomPercent: clamp(settings.zoomPercent + action.delta, 100, 130) };
    case "speed_delta":
      return { ...settings, speed: clamp(roundOneDecimal(settings.speed + action.delta), 0.8, 1.3) };
    case "toggle_mirror":
      return { ...settings, mirror: !settings.mirror };
    case "toggle_auto_cut":
      return { ...settings, autoCut: !settings.autoCut };
    case "toggle_antiduplication":
      return { ...settings, antiduplication: !settings.antiduplication };
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function roundOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}
