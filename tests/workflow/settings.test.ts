import { describe, expect, it } from "vitest";
import { DEFAULT_BATCH_SETTINGS, updateSetting } from "../../src/workflow/settings.js";

describe("batch settings", () => {
  it("uses the MVP defaults", () => {
    expect(DEFAULT_BATCH_SETTINGS).toMatchObject({
      autoCut: true,
      zoomPercent: 105,
      speed: 1,
      mirror: false,
      trimStartSeconds: 0.3,
      trimEndSeconds: 0.3,
      antiduplication: true,
      cta: true,
      watermark: false
    });
  });

  it("updates zoom globally within bounds", () => {
    const settings = updateSetting(DEFAULT_BATCH_SETTINGS, { type: "zoom_delta", delta: 5 });

    expect(settings.zoomPercent).toBe(110);
  });

  it("toggles mirror globally", () => {
    const settings = updateSetting(DEFAULT_BATCH_SETTINGS, { type: "toggle_mirror" });

    expect(settings.mirror).toBe(true);
  });

  it("updates trim start and end globally within bounds", () => {
    const start = updateSetting(DEFAULT_BATCH_SETTINGS, { type: "trim_start_delta", delta: 0.2 });
    const end = updateSetting(DEFAULT_BATCH_SETTINGS, { type: "trim_end_delta", delta: -0.4 });

    expect(start.trimStartSeconds).toBe(0.5);
    expect(end.trimEndSeconds).toBe(0);
  });

  it("toggles CTA and watermark globally", () => {
    const withCtaDisabled = updateSetting(DEFAULT_BATCH_SETTINGS, { type: "toggle_cta" });
    const withWatermarkEnabled = updateSetting(DEFAULT_BATCH_SETTINGS, { type: "toggle_watermark" });

    expect(withCtaDisabled.cta).toBe(false);
    expect(withWatermarkEnabled.watermark).toBe(true);
  });
});
