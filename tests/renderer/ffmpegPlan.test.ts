import { describe, expect, it } from "vitest";
import { buildFfmpegArgs } from "../../src/renderer/ffmpegPlan.js";
import { TEMPLATES } from "../../src/templates/templates.js";
import { DEFAULT_BATCH_SETTINGS } from "../../src/workflow/settings.js";

describe("buildFfmpegArgs", () => {
  it("builds a 9:16 mp4 render command", () => {
    const args = buildFfmpegArgs({
      inputPath: "/tmp/in.mp4",
      outputPath: "/tmp/out.mp4",
      template: TEMPLATES[0],
      settings: DEFAULT_BATCH_SETTINGS
    });

    expect(args).toContain("-i");
    expect(args).toContain("/tmp/in.mp4");
    expect(args).toContain("-filter_complex");
    expect(args).toContain("-c:v");
    expect(args).toContain("libx264");
    expect(args).toContain("/tmp/out.mp4");
  });

  it("adds horizontal flip when mirror is enabled", () => {
    const args = buildFfmpegArgs({
      inputPath: "/tmp/in.mp4",
      outputPath: "/tmp/out.mp4",
      template: TEMPLATES[0],
      settings: { ...DEFAULT_BATCH_SETTINGS, mirror: true }
    });

    expect(args.join(" ")).toContain("hflip");
  });

  it("uses input duration to trim the end of the video", () => {
    const args = buildFfmpegArgs({
      inputPath: "/tmp/in.mp4",
      outputPath: "/tmp/out.mp4",
      template: TEMPLATES[0],
      settings: { ...DEFAULT_BATCH_SETTINGS, trimStartSeconds: 0.3, trimEndSeconds: 0.7 },
      inputDurationSeconds: 10
    });

    expect(args.join(" ")).toContain("trim=start=0.3:end=9.3");
  });
});
