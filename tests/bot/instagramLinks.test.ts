import { describe, expect, it } from "vitest";
import { extractInstagramMediaUrls, normalizeInstagramMediaUrl } from "../../src/bot/instagramLinks.js";

describe("Instagram link parsing", () => {
  it("extracts unique Instagram media links from a text message", () => {
    expect(
      extractInstagramMediaUrls(
        "Links: https://instagram.com/reel/ABC123/?utm_source=x https://www.instagram.com/p/POST123/ https://instagram.com/reel/ABC123/?utm_source=x"
      )
    ).toEqual(["https://www.instagram.com/reel/ABC123/", "https://www.instagram.com/p/POST123/"]);
  });

  it("rejects unsupported Instagram paths and external hosts", () => {
    expect(normalizeInstagramMediaUrl("https://www.instagram.com/accounts/login/")).toBeNull();
    expect(normalizeInstagramMediaUrl("https://example.com/reel/ABC123/")).toBeNull();
  });
});
