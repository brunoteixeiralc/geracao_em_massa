import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Client, InStatement } from "@libsql/client";
import { parseEnv } from "../config/env.js";
import { createDbClient } from "./client.js";

const rootDir = process.cwd();
const migrationsDir = join(rootDir, "db/migrations");

export async function applyMigrations(db: Pick<Client, "execute" | "batch">) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const appliedResult = await db.execute("SELECT version FROM schema_migrations");
  const applied = new Set(appliedResult.rows.map((row) => String(row.version)));
  const migrationFiles = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
  const appliedVersions: string[] = [];

  for (const migrationFile of migrationFiles) {
    const version = basename(migrationFile, ".sql");
    if (applied.has(version)) {
      continue;
    }

    const sql = await readFile(join(migrationsDir, migrationFile), "utf8");
    const statements: InStatement[] = sql
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean)
      .map((statement) => ({ sql: statement, args: [] }));

    await db.batch(
      [
        ...statements,
        {
          sql: "INSERT INTO schema_migrations (version) VALUES (?)",
          args: [version]
        }
      ],
      "write"
    );
    appliedVersions.push(version);
  }

  return appliedVersions;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const env = parseEnv(process.env);
  const db = createDbClient(env);
  const appliedVersions = await applyMigrations(db);

  if (appliedVersions.length === 0) {
    console.log("No pending migrations");
  } else {
    console.log(`Applied migrations: ${appliedVersions.join(", ")}`);
  }
}
