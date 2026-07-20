import type { InArgs, ResultSet } from "@libsql/client";
import type { Batch, BatchVideo } from "../workflow/batchWorkflow.js";
import type { BatchSettings } from "../workflow/settings.js";
import type { BatchStatus, VideoStatus } from "../workflow/status.js";

export type DatabaseClient = {
  execute(statement: { sql: string; args?: InArgs }): Promise<ResultSet>;
};

export type BatchRow = {
  id: string;
  user_id: string;
  telegram_user_id: string;
  template_id: string | null;
  status: string;
  settings_json: string;
  status_panel_chat_id: string | null;
  status_panel_message_id: string | null;
  output_zip_url: string | null;
  created_at: string;
  updated_at: string;
};

export type VideoRow = {
  id: string;
  batch_id: string;
  telegram_file_id: string;
  original_file_name: string;
  size_bytes: number;
  status: string;
  output_url: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export function mapBatchRow(row: BatchRow): Batch {
  return {
    id: row.id,
    telegramUserId: row.telegram_user_id,
    status: row.status as BatchStatus,
    templateId: row.template_id,
    settings: JSON.parse(row.settings_json) as BatchSettings,
    videos: []
  };
}

export function mapVideoRow(row: VideoRow): BatchVideo {
  return {
    id: row.id,
    fileId: row.telegram_file_id,
    fileName: row.original_file_name,
    sizeBytes: row.size_bytes,
    status: row.status as VideoStatus
  };
}

export class LibsqlBatchRepository {
  constructor(private readonly client: DatabaseClient) {}

  async createBatch(batch: Batch, username?: string) {
    const userId = userIdFromTelegramId(batch.telegramUserId);
    await this.client.execute({
      sql: `
        INSERT INTO users (id, telegram_user_id, username)
        VALUES (?, ?, ?)
        ON CONFLICT(telegram_user_id) DO UPDATE SET username = excluded.username
      `,
      args: [userId, batch.telegramUserId, username ?? null]
    });

    await this.client.execute({
      sql: `
        UPDATE batches
        SET status = 'cancelled',
            updated_at = datetime('now')
        WHERE user_id = ?
          AND status NOT IN ('completed', 'failed', 'cancelled')
      `,
      args: [userId]
    });

    await this.client.execute({
      sql: `
        INSERT INTO batches (id, user_id, template_id, status, settings_json)
        VALUES (?, ?, ?, ?, ?)
      `,
      args: [batch.id, userId, batch.templateId, batch.status, JSON.stringify(batch.settings)]
    });
  }

  async findActiveBatchByTelegramUserId(telegramUserId: string): Promise<Batch | null> {
    const batchResult = await this.client.execute({
      sql: `
        SELECT batches.*, users.telegram_user_id
        FROM batches
        INNER JOIN users ON users.id = batches.user_id
        WHERE users.telegram_user_id = ?
          AND batches.status NOT IN ('completed', 'failed', 'cancelled')
        ORDER BY batches.updated_at DESC
        LIMIT 1
      `,
      args: [telegramUserId]
    });

    const row = batchResult.rows[0] as unknown as BatchRow | undefined;
    if (!row) {
      return null;
    }

    const videosResult = await this.client.execute({
      sql: `
        SELECT *
        FROM videos
        WHERE batch_id = ?
        ORDER BY created_at ASC
      `,
      args: [row.id]
    });

    return {
      ...mapBatchRow(row),
      videos: videosResult.rows.map((videoRow) => mapVideoRow(videoRow as unknown as VideoRow))
    };
  }

  async saveBatch(batch: Batch) {
    await this.client.execute({
      sql: `
        UPDATE batches
        SET template_id = ?,
            status = ?,
            settings_json = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `,
      args: [batch.templateId, batch.status, JSON.stringify(batch.settings), batch.id]
    });

    for (const video of batch.videos) {
      await this.client.execute({
        sql: `
          INSERT INTO videos (id, batch_id, telegram_file_id, original_file_name, size_bytes, status)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            telegram_file_id = excluded.telegram_file_id,
            original_file_name = excluded.original_file_name,
            size_bytes = excluded.size_bytes,
            status = excluded.status,
            updated_at = datetime('now')
        `,
        args: [video.id, batch.id, video.fileId, video.fileName, video.sizeBytes, video.status]
      });
    }
  }
}

function userIdFromTelegramId(telegramUserId: string) {
  return `telegram:${telegramUserId}`;
}
