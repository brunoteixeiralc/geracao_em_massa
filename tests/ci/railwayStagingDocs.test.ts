import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const readProjectFile = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const migrationFiles = [
  "db/migrations/001_initial_schema.sql",
  "db/migrations/002_video_input_path.sql",
  "db/migrations/003_video_output_path.sql"
];

describe("repository privacy guardrails", () => {
  test("keeps internal docs and local data ignored without hiding production migrations", () => {
    const gitignore = readProjectFile(".gitignore");
    const migrateScript = readProjectFile("src/db/migrate.ts");
    const packageJson = JSON.parse(readProjectFile("package.json")) as {
      scripts?: Record<string, string>;
    };

    expect(gitignore).toContain("docs/");
    expect(gitignore).toContain("*.db");
    expect(gitignore).toContain("*.sqlite");
    expect(gitignore).toContain("*.sqlite3");
    expect(gitignore).toContain("db/backups/");
    expect(gitignore).toContain("db/dumps/");
    expect(gitignore).toContain("db/migrations/*.local.sql");
    expect(gitignore).toContain("db/migrations/*.private.sql");
    expect(gitignore).toContain("db/migrations/*secret*.sql");

    expect(packageJson.scripts?.["db:migrate"]).toBe("tsx src/db/migrate.ts");
    expect(migrateScript).toContain('"db/migrations"');

    for (const migrationFile of migrationFiles) {
      expect(readProjectFile(migrationFile).trim().length).toBeGreaterThan(0);
    }
  });
});
