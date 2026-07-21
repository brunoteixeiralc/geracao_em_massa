import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const readProjectFile = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Node.js runtime", () => {
  test("uses Node 22 in Docker, GitHub Actions, and package metadata", () => {
    const dockerfile = readProjectFile("Dockerfile");
    const packageJson = JSON.parse(readProjectFile("package.json")) as {
      engines?: { node?: string; npm?: string };
      devDependencies?: Record<string, string>;
    };

    expect(dockerfile).toContain("FROM node:22-bookworm-slim AS base");
    expect(packageJson.engines?.node).toBe(">=22");
    expect(packageJson.engines?.npm).toBe(">=10");
    expect(packageJson.devDependencies?.["@types/node"]).toContain("22");

    for (const workflowPath of [
      ".github/workflows/ci.yml",
      ".github/workflows/release.yml",
      ".github/workflows/auto-release.yml"
    ]) {
      expect(readProjectFile(workflowPath)).toContain("node-version: 22");
    }
  });
});
