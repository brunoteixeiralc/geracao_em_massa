import { createClient } from "@libsql/client";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { nanoid } from "nanoid";
import { describe, expect, it } from "vitest";
import { applyMigrations } from "../../src/db/migrate.js";

describe("applyMigrations", () => {
  it("applies all pending migrations in order", async () => {
    const client = createClient({ url: `file:${join(tmpdir(), `reels-migrate-${nanoid()}.db`)}` });

    await applyMigrations(client);

    const migrations = await client.execute("SELECT version FROM schema_migrations ORDER BY version");
    const columns = await client.execute("PRAGMA table_info(videos)");

    expect(migrations.rows.map((row) => row.version)).toEqual(["001_initial_schema", "002_video_input_path"]);
    expect(columns.rows.map((row) => row.name)).toContain("input_path");
  });
});
