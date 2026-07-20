import { describe, expect, it } from "vitest";
import { validateMediaInput } from "../../src/security/media.js";

describe("validateMediaInput", () => {
  it("accepts an MP4 under the configured size limit", () => {
    expect(
      validateMediaInput({
        fileName: "clip.mp4",
        mimeType: "video/mp4",
        sizeBytes: 1024,
        maxInputBytes: 20 * 1024 * 1024
      })
    ).toEqual({ ok: true });
  });

  it("rejects a file above the configured size limit", () => {
    expect(
      validateMediaInput({
        fileName: "clip.mp4",
        mimeType: "video/mp4",
        sizeBytes: 25 * 1024 * 1024,
        maxInputBytes: 20 * 1024 * 1024
      })
    ).toEqual({ ok: false, reason: "Arquivo maior que 20 MB." });
  });

  it("rejects unsupported MIME types", () => {
    expect(
      validateMediaInput({
        fileName: "clip.exe",
        mimeType: "application/octet-stream",
        sizeBytes: 1024,
        maxInputBytes: 20 * 1024 * 1024
      })
    ).toEqual({ ok: false, reason: "Envie apenas videos MP4, MOV ou WEBM." });
  });
});
