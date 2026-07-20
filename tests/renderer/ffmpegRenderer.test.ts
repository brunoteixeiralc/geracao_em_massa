import { EventEmitter } from "node:events";
import { stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PassThrough, type Readable } from "node:stream";
import { nanoid } from "nanoid";
import { describe, expect, it } from "vitest";
import { createFfmpegRenderer } from "../../src/renderer/ffmpegRenderer.js";
import { TEMPLATES } from "../../src/templates/templates.js";
import { DEFAULT_BATCH_SETTINGS } from "../../src/workflow/settings.js";

describe("createFfmpegRenderer", () => {
  it("renders a video to a generated output path with ffmpeg args", async () => {
    const workDir = join(tmpdir(), `reels-render-${nanoid()}`);
    const spawnCalls: Array<{ command: string; args: string[] }> = [];
    const renderer = createFfmpegRenderer({
      workDir,
      ffmpegPath: "ffmpeg-test",
      createOutputId: () => "render-123",
      probeDurationSeconds: async () => 10,
      spawnProcess: (command, args) => {
        spawnCalls.push({ command, args });
        return closingProcess(0);
      }
    });

    const result = await renderer.renderVideo({
      batchId: "batch-1",
      videoId: "video-1",
      inputPath: ".data/reels-bot/batch-1/video-1.mp4",
      template: TEMPLATES[0],
      settings: DEFAULT_BATCH_SETTINGS
    });

    const expectedOutputPath = resolve(workDir, "batch-1", "rendered", "video-1-render-123.mp4");
    expect(result).toEqual({ outputPath: expectedOutputPath });
    expect((await stat(join(workDir, "batch-1", "rendered"))).isDirectory()).toBe(true);
    expect(spawnCalls).toHaveLength(1);
    expect(spawnCalls[0].command).toBe("ffmpeg-test");
    expect(spawnCalls[0].args).toContain(".data/reels-bot/batch-1/video-1.mp4");
    expect(spawnCalls[0].args).toContain(expectedOutputPath);
    expect(spawnCalls[0].args.join(" ")).toContain("trim=start=0.3:end=9.7");
  });

  it("throws with stderr when ffmpeg exits with a non-zero code", async () => {
    const renderer = createFfmpegRenderer({
      workDir: join(tmpdir(), `reels-render-${nanoid()}`),
      createOutputId: () => "render-123",
      probeDurationSeconds: async () => 10,
      spawnProcess: () => closingProcess(1, "invalid input")
    });

    await expect(
      renderer.renderVideo({
        batchId: "batch-1",
        videoId: "video-1",
        inputPath: ".data/reels-bot/batch-1/video-1.mp4",
        template: TEMPLATES[0],
        settings: DEFAULT_BATCH_SETTINGS
      })
    ).rejects.toThrow("FFmpeg failed with code 1: invalid input");
  });

  it("probes video duration with ffprobe by default", async () => {
    const commands: string[] = [];
    const renderer = createFfmpegRenderer({
      workDir: join(tmpdir(), `reels-render-${nanoid()}`),
      ffmpegPath: "ffmpeg-test",
      ffprobePath: "ffprobe-test",
      createOutputId: () => "render-123",
      spawnProcess: (command) => {
        commands.push(command);
        return command === "ffprobe-test" ? closingProcess(0, "", "12.5\n") : closingProcess(0);
      }
    });

    await renderer.renderVideo({
      batchId: "batch-1",
      videoId: "video-1",
      inputPath: ".data/reels-bot/batch-1/video-1.mp4",
      template: TEMPLATES[0],
      settings: DEFAULT_BATCH_SETTINGS
    });

    expect(commands).toEqual(["ffprobe-test", "ffmpeg-test"]);
  });
});

function closingProcess(code: number, stderr = "", stdout = "") {
  const process = new EventEmitter() as EventEmitter & { stdout: Readable; stderr: Readable };
  const stdoutStream = new PassThrough();
  const stderrStream = new PassThrough();
  process.stdout = stdoutStream;
  process.stderr = stderrStream;

  queueMicrotask(() => {
    if (stdout) {
      stdoutStream.write(stdout);
    }
    if (stderr) {
      stderrStream.write(stderr);
    }
    stdoutStream.end();
    stderrStream.end();
    process.emit("close", code);
  });

  return process;
}
