import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const stagingGuidePath = join(process.cwd(), "docs", "railway-staging.md");
const readProjectFile = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

function parseExampleEnvKeys() {
  return readProjectFile(".env.example")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => line.split("=")[0])
    .filter((key): key is string => Boolean(key));
}

describe("Railway staging guide", () => {
  test("documents deployment services, environment variables, and smoke test", () => {
    expect(existsSync(stagingGuidePath)).toBe(true);

    const guide = readFileSync(stagingGuidePath, "utf8");

    expect(guide).toContain("npm run start");
    expect(guide).toContain("npm run start:worker");
    expect(guide).toContain("/health");
    expect(guide).toContain("/telegram/${TELEGRAM_WEBHOOK_SECRET}");
    expect(guide).toContain("npm run db:migrate");
    expect(guide).toContain("Smoke Test");
    expect(guide).toContain("Turso");
    expect(guide).toContain("Redis");
    expect(guide).toContain("S3/R2");

    for (const key of parseExampleEnvKeys()) {
      expect(guide).toContain(key);
    }
  });
});
