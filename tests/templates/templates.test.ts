import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getTemplateById, loadTemplatesFromDirectory, TEMPLATES } from "../../src/templates/templates.js";

const fixturesRoot = join(process.cwd(), "tests", "fixtures", "templates");
const tmpRoots: string[] = [];

describe("file-backed templates", () => {
  afterEach(async () => {
    await Promise.all(tmpRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

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

  it("rejects template folders without template.json", async () => {
    const rootDir = await createTmpRoot("missing-template-json");
    await mkdir(join(rootDir, "fixture-a"), { recursive: true });

    expect(() => loadTemplatesFromDirectory(rootDir)).toThrow("missing template.json");
  });

  it("rejects template ids that do not match the folder name", async () => {
    const rootDir = await createTmpRoot("mismatched-folder-name");
    const templateDir = join(rootDir, "fixture-a");
    await mkdir(templateDir, { recursive: true });
    await writeFile(join(templateDir, "preview.svg"), "<svg />");
    await writeFile(join(templateDir, "avatar.svg"), "<svg />");
    await writeFile(
      join(templateDir, "template.json"),
      JSON.stringify({
        id: "fixture-b",
        name: "Fixture B",
        previewPath: "tests/.tmp/templates-loader/mismatched-folder-name/fixture-a/preview.svg",
        canvas: { width: 1080, height: 1920 },
        videoBox: { x: 90, y: 620, width: 900, height: 1120 },
        header: {
          avatarPath: "tests/.tmp/templates-loader/mismatched-folder-name/fixture-a/avatar.svg",
          displayName: "Fixture B Channel",
          handle: "@fixtureb",
          headline: "Fixture B headline"
        }
      })
    );

    expect(() => loadTemplatesFromDirectory(rootDir)).toThrow("id must match folder name fixture-a");
  });

  it("loads production templates from assets", () => {
    expect(TEMPLATES.map((template) => template.id)).toContain("humor-cachorro");
    expect(getTemplateById("humor-cachorro")?.name).toBe("Humor Cachorro");
    expect(getTemplateById("humor-cachorro")).toMatchObject({
      name: "Humor Cachorro",
      kind: "frame",
      framePath: "assets/templates/humor-cachorro/frame.png",
      videoBox: { x: 0, y: 761, width: 1080, height: 1159 },
      keyColor: "#00FF01"
    });
  });
});

async function createTmpRoot(id: string) {
  const rootDir = join(process.cwd(), "tests", ".tmp", "templates-loader", id);
  tmpRoots.push(rootDir);
  await mkdir(rootDir, { recursive: true });
  return rootDir;
}
