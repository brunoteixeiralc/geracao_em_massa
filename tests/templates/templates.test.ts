import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getTemplateById, loadTemplatesFromDirectory, TEMPLATES } from "../../src/templates/templates.js";

const fixturesRoot = join(process.cwd(), "tests", "fixtures", "templates");

describe("file-backed templates", () => {
  it("loads templates from folders sorted by display name", () => {
    const templates = loadTemplatesFromDirectory(join(fixturesRoot, "valid"));

    expect(templates.map((template) => template.id)).toEqual(["fixture-a", "fixture-b"]);
    expect(templates[0]).toMatchObject({
      id: "fixture-a",
      name: "Fixture A",
      previewPath: "tests/fixtures/templates/valid/fixture-a/preview.svg",
      canvas: { width: 1080, height: 1920 },
      videoBox: { x: 90, y: 620, width: 900, height: 1120 },
      header: {
        avatarPath: "tests/fixtures/templates/valid/fixture-a/avatar.svg",
        displayName: "Fixture A Channel",
        handle: "@fixturea",
        headline: "Fixture A headline"
      }
    });
  });

  it("rejects invalid template JSON", () => {
    expect(() => loadTemplatesFromDirectory(join(fixturesRoot, "invalid"))).toThrow("Invalid template");
  });

  it("loads production templates from assets", () => {
    expect(TEMPLATES.map((template) => template.id)).toContain("humor-crocodilo");
    expect(getTemplateById("humor-crocodilo")?.name).toBe("Humor Crocodilo");
    expect(getTemplateById("humor-crocodilo")).toMatchObject({
      kind: "frame",
      framePath: "assets/templates/humor-crocodilo/frame.png"
    });
    expect(getTemplateById("humor-cachorro")).toMatchObject({
      name: "Humor Cachorro",
      kind: "frame",
      framePath: "assets/templates/humor-cachorro/frame.png",
      videoBox: { x: 0, y: 761, width: 1080, height: 1159 },
      keyColor: "#00FF01"
    });
  });
});
