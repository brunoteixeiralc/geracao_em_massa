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
});
