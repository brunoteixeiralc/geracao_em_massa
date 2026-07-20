import { describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { nanoid } from "nanoid";
import { LibsqlBatchRepository, mapBatchRow, mapVideoRow } from "../../src/db/repositories.js";
import { createDraftBatch, receiveVideo, selectTemplate } from "../../src/workflow/batchWorkflow.js";
import { DEFAULT_BATCH_SETTINGS } from "../../src/workflow/settings.js";

describe("db repository mappers", () => {
  it("maps a batch row into a domain batch", () => {
    const batch = mapBatchRow({
      id: "batch-1",
      user_id: "user-1",
      telegram_user_id: "123",
      template_id: "humor-01",
      status: "settings",
      settings_json: JSON.stringify(DEFAULT_BATCH_SETTINGS),
      status_panel_chat_id: "123",
      status_panel_message_id: "456",
      output_zip_url: null,
      created_at: "2026-07-20 10:00:00",
      updated_at: "2026-07-20 10:00:00"
    });

    expect(batch).toMatchObject({
      id: "batch-1",
      telegramUserId: "123",
      status: "settings",
      templateId: "humor-01",
      settings: DEFAULT_BATCH_SETTINGS,
      videos: []
    });
  });

  it("maps a video row into a domain video", () => {
    const video = mapVideoRow({
      id: "video-1",
      batch_id: "batch-1",
      telegram_file_id: "file-1",
      original_file_name: "one.mp4",
      size_bytes: 1234,
      status: "ready",
      output_url: "https://files.example.com/one.mp4",
      error_message: null,
      created_at: "2026-07-20 10:00:00",
      updated_at: "2026-07-20 10:00:00"
    });

    expect(video).toMatchObject({
      id: "video-1",
      fileId: "file-1",
      fileName: "one.mp4",
      sizeBytes: 1234,
      status: "ready"
    });
  });
});

describe("LibsqlBatchRepository", () => {
  it("persists and loads the active Telegram batch with videos", async () => {
    const client = createClient({ url: `file:${join(tmpdir(), `reels-repo-${nanoid()}.db`)}` });
    await migrateTestDatabase(client);
    const repository = new LibsqlBatchRepository(client);

    let batch = createDraftBatch({ id: "batch-1", telegramUserId: "123" });
    await repository.createBatch(batch, "bruno");

    batch = selectTemplate(batch, "humor-01");
    batch = receiveVideo(batch, { id: "video-1", fileId: "file-1", fileName: "clip.mp4", sizeBytes: 1024 }, 50);
    await repository.saveBatch(batch);

    const activeBatch = await repository.findActiveBatchByTelegramUserId("123");

    expect(activeBatch).toMatchObject({
      id: "batch-1",
      telegramUserId: "123",
      status: "receiving",
      templateId: "humor-01",
      videos: [{ id: "video-1", fileId: "file-1", fileName: "clip.mp4", sizeBytes: 1024, status: "received" }]
    });
  });

  it("keeps only the newest Telegram batch active for the user", async () => {
    const client = createClient({ url: `file:${join(tmpdir(), `reels-repo-${nanoid()}.db`)}` });
    await migrateTestDatabase(client);
    const repository = new LibsqlBatchRepository(client);

    await repository.createBatch(createDraftBatch({ id: "batch-1", telegramUserId: "123" }));
    await repository.createBatch(createDraftBatch({ id: "batch-2", telegramUserId: "123" }));

    const activeBatch = await repository.findActiveBatchByTelegramUserId("123");

    expect(activeBatch?.id).toBe("batch-2");
  });
});

async function migrateTestDatabase(client: { execute(statement: string): Promise<unknown> }) {
  const migration = await readFile("db/migrations/001_initial_schema.sql", "utf8");
  for (const statement of migration.split(";").map((sql) => sql.trim()).filter(Boolean)) {
    await client.execute(statement);
  }
}
