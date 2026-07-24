import { describe, expect, it } from "vitest";
import { buildAntiduplicationVariant } from "../../src/renderer/antiduplication.js";

describe("buildAntiduplicationVariant", () => {
  it("creates deterministic variants for the same batch video seed", () => {
    expect(buildAntiduplicationVariant("batch-1:video-1")).toEqual(buildAntiduplicationVariant("batch-1:video-1"));
  });

  it("creates different signatures for different videos", () => {
    const first = buildAntiduplicationVariant("batch-1:video-1");
    const second = buildAntiduplicationVariant("batch-1:video-2");

    expect(first).not.toEqual(second);
    expect(first.metadataComment).not.toBe(second.metadataComment);
    expect(first.noiseSeed).not.toBe(second.noiseSeed);
  });

  it("keeps every variation inside conservative render ranges", () => {
    const variant = buildAntiduplicationVariant("batch-1:video-1");

    expect(variant.brightness).toBeGreaterThanOrEqual(-0.004);
    expect(variant.brightness).toBeLessThanOrEqual(0.004);
    expect(variant.contrast).toBeGreaterThanOrEqual(0.996);
    expect(variant.contrast).toBeLessThanOrEqual(1.006);
    expect(variant.saturation).toBeGreaterThanOrEqual(0.996);
    expect(variant.saturation).toBeLessThanOrEqual(1.008);
    expect(variant.audioVolume).toBeGreaterThanOrEqual(0.985);
    expect(variant.audioVolume).toBeLessThanOrEqual(1.015);
    expect(variant.videoCrf).toBeGreaterThanOrEqual(22);
    expect(variant.videoCrf).toBeLessThanOrEqual(24);
    expect(variant.gopSize).toBeGreaterThanOrEqual(54);
    expect(variant.gopSize).toBeLessThanOrEqual(72);
  });
});
