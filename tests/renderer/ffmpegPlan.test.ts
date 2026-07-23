import { describe, expect, it } from "vitest";
import { buildFfmpegArgs } from "../../src/renderer/ffmpegPlan.js";
import { getTemplateById } from "../../src/templates/templates.js";
import { DEFAULT_BATCH_SETTINGS } from "../../src/workflow/settings.js";

const crocodiloTemplate = getTemplateById("humor-crocodilo")!;
const cachorroTemplate = getTemplateById("humor-cachorro")!;

describe("buildFfmpegArgs", () => {
  it("builds a 9:16 mp4 render command", () => {
    const args = buildFfmpegArgs({
      inputPath: "/tmp/in.mp4",
      outputPath: "/tmp/out.mp4",
      template: crocodiloTemplate,
      settings: DEFAULT_BATCH_SETTINGS
    });

    expect(args).toContain("-i");
    expect(args).toContain("/tmp/in.mp4");
    expect(args).toContain("-filter_complex");
    expect(args).toContain("-c:v");
    expect(args).toContain("libx264");
    expect(args).toContain("/tmp/out.mp4");
  });

  it("composes the cropped video into the template canvas", () => {
    const args = buildFfmpegArgs({
      inputPath: "/tmp/in.mp4",
      outputPath: "/tmp/out.mp4",
      template: crocodiloTemplate,
      settings: DEFAULT_BATCH_SETTINGS
    });
    const joinedArgs = args.join(" ");

    expect(joinedArgs).toContain("color=c=white:s=1080x1920");
    expect(joinedArgs).toContain("overlay=90:620:shortest=1");
    expect(joinedArgs).toContain("-map [composed]");
  });

  it("overlays frame templates over the composed video", () => {
    const args = buildFfmpegArgs({
      inputPath: "/tmp/in.mp4",
      outputPath: "/tmp/out.mp4",
      template: {
        ...crocodiloTemplate,
        kind: "frame",
        framePath: "assets/templates/humor-crocodilo/frame.png"
      },
      settings: DEFAULT_BATCH_SETTINGS
    });
    const joinedArgs = args.join(" ");

    expect(joinedArgs).toContain("-loop 1 -i assets/templates/humor-crocodilo/frame.png");
    expect(joinedArgs).toContain("[1:v]format=rgba[frame]");
    expect(joinedArgs).toContain("[canvas][video]overlay=90:620:shortest=1[video_on_canvas]");
    expect(joinedArgs).toContain("[video_on_canvas][frame]overlay=0:0:shortest=1");
    expect(joinedArgs).toContain("[composed]");
  });

  it("keys out a frame template marker color before overlaying it", () => {
    const args = buildFfmpegArgs({
      inputPath: "/tmp/in.mp4",
      outputPath: "/tmp/out.mp4",
      template: cachorroTemplate,
      settings: DEFAULT_BATCH_SETTINGS
    });
    const joinedArgs = args.join(" ");

    expect(joinedArgs).toContain("[1:v]format=rgba,colorkey=0x00ff01:0.03:0.0[frame]");
    expect(joinedArgs).toContain("[video_on_canvas][frame]overlay=0:0:shortest=1");
  });

  it("adds horizontal flip when mirror is enabled", () => {
    const args = buildFfmpegArgs({
      inputPath: "/tmp/in.mp4",
      outputPath: "/tmp/out.mp4",
      template: crocodiloTemplate,
      settings: { ...DEFAULT_BATCH_SETTINGS, mirror: true }
    });

    expect(args.join(" ")).toContain("hflip");
  });

  it("uses input duration to trim the end of the video", () => {
    const args = buildFfmpegArgs({
      inputPath: "/tmp/in.mp4",
      outputPath: "/tmp/out.mp4",
      template: crocodiloTemplate,
      settings: { ...DEFAULT_BATCH_SETTINGS, trimStartSeconds: 0.3, trimEndSeconds: 0.7 },
      inputDurationSeconds: 10
    });

    expect(args.join(" ")).toContain("trim=start=0.3:end=9.3");
  });

  it("applies safe antiduplication normalization when enabled", () => {
    const args = buildFfmpegArgs({
      inputPath: "/tmp/in.mp4",
      outputPath: "/tmp/out.mp4",
      template: crocodiloTemplate,
      settings: { ...DEFAULT_BATCH_SETTINGS, antiduplication: true }
    });
    const joinedArgs = args.join(" ");

    expect(joinedArgs).toContain("color=c=white:s=1080x1920:r=30[canvas]");
    expect(joinedArgs).toContain("fps=30,setsar=1[video]");
    expect(joinedArgs).toContain("-map_metadata -1");
    expect(joinedArgs).toContain("-map_chapters -1");
  });

  it("keeps the render command untouched by antiduplication when disabled", () => {
    const args = buildFfmpegArgs({
      inputPath: "/tmp/in.mp4",
      outputPath: "/tmp/out.mp4",
      template: crocodiloTemplate,
      settings: { ...DEFAULT_BATCH_SETTINGS, antiduplication: false }
    });
    const joinedArgs = args.join(" ");

    expect(joinedArgs).not.toContain("fps=30,setsar=1[video]");
    expect(joinedArgs).not.toContain("-map_metadata -1");
    expect(joinedArgs).not.toContain("-map_chapters -1");
  });
});
