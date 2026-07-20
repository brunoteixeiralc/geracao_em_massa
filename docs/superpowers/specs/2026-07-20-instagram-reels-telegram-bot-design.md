# Instagram Reels Bulk Generator via Telegram - Design

## Summary

Build an MVP for bulk Instagram Reels generation controlled entirely through a Telegram bot. The user chooses a fixed template, uploads up to 50 short videos, optionally changes global batch settings, starts processing, tracks progress through a live Telegram status panel, and receives the finished Reels both directly in Telegram when possible and through a ZIP download link.

The app will run on Railway. Video processing will use FFmpeg. Temporary processing files may use local disk during a job, but final outputs and ZIP files should be stored in object storage because Railway service filesystems are ephemeral unless a volume is attached.

## MVP Decisions

- Content type: Reels only.
- Interface: Telegram bot only, no web app in the MVP.
- Hosting: Railway.
- Source control: GitHub after the project is scaffolded.
- Templates: fixed templates configured by the system.
- Batch size: up to 50 videos per lot.
- Input files: normally under 20 MB per video, compatible with Telegram Bot API file download constraints.
- Output delivery: direct Telegram delivery for files that fit Telegram limits, plus ZIP link with all finished videos.
- Settings: global settings per batch. If the user changes zoom, speed, trimming, or similar settings, the change applies to every video in that batch.
- Status UX: Telegram live panel that shows the current phase, progress, per-video status, and errors.

## User Flow

1. User starts a new lot with `/novo_lote`.
2. Bot creates a draft batch and shows the live status panel.
3. Bot asks the user to choose one fixed template using inline buttons.
4. User uploads videos to the Telegram chat.
5. Bot validates each video and updates the panel with received count, rejected files, and current limit.
6. User taps `Finalizar envio`.
7. Bot shows global batch settings with inline buttons.
8. User can adjust settings or keep the defaults.
9. User taps `Processar lote`.
10. Bot enqueues the batch.
11. Worker downloads files from Telegram, validates media, renders every Reel, creates the ZIP, uploads outputs, and reports progress.
12. Bot sends each finished video when it fits Telegram limits and sends the ZIP link.
13. Bot marks the lot as complete and keeps a history record.

## Telegram UX

The bot should use one main editable message as the lot panel. It should avoid flooding the chat with progress messages.

Example panel states:

```text
Lote #522
Template: Humor 01
Videos: 18/50 recebidos
Status: Recebendo videos

[Finalizar envio]
[Cancelar lote]
```

```text
Lote #522
Template: Humor 01
Videos: 50

Ajustes do lote
Corte automatico: ligado
Zoom: 105%
Velocidade: 1.0x
Espelhar: desligado
Cortar inicio: 0.3s
Cortar fim: 0.3s
Antiduplicidade: ligado
CTA: ligado
Marca d'agua: desligado

[Zoom -] [Zoom +]
[Vel -] [Vel +]
[Espelhar on/off]
[Processar lote]
```

```text
Lote #522
Status: Renderizando
Progresso: 23/50 videos

2758059901086158148.mp4 - pronto
-6535990949013649396.mp4 - renderizando
-5774394096073499063.mp4 - na fila
```

The bot can send short separate messages only for key transitions: batch created, processing started, batch completed, unrecoverable error.

## Architecture

The MVP should use a small service split into clear modules:

- Telegram bot adapter: receives commands, callback queries, video uploads, and edits live panel messages.
- Batch workflow service: owns batch state transitions and validates which user actions are allowed.
- Queue service: schedules video processing jobs and prevents the bot request handler from doing heavy FFmpeg work.
- Worker service: performs downloads, media validation, rendering, ZIP creation, uploads, and progress events.
- Renderer module: builds FFmpeg command plans from template and global settings.
- Storage module: stores original videos, rendered videos, thumbnails, and ZIP files.
- Database module: persists users, batches, video records, settings, status panel message IDs, and output links.

For Railway, the simplest deployment can start as one Node.js service running both the bot and worker with controlled concurrency. If processing load grows, split into two Railway services later:

- `bot`: webhook/API handling and Telegram updates.
- `worker`: queue consumer and FFmpeg processor.

## Suggested Stack

- Runtime: Node.js with TypeScript.
- Telegram framework: grammY.
- Video engine: FFmpeg installed in the deploy image.
- Queue: BullMQ with Redis.
- Database: PostgreSQL.
- Storage: S3-compatible object storage. Prefer Railway storage buckets if available in the target project; otherwise use Cloudflare R2.
- Deployment: one Railway service from GitHub for the MVP, with a Dockerfile so FFmpeg availability is explicit.

Node.js is a good fit because Telegram bot handling, queues, storage SDKs, and Railway deployment are straightforward. FFmpeg remains the actual video engine.

## Data Model

Core tables:

- `users`: Telegram user ID, username, first seen timestamp, plan/permissions if added later.
- `templates`: fixed template ID, name, preview asset path, render configuration.
- `batches`: owner user, template, status, global settings JSON, counts, status panel chat/message IDs, output ZIP URL.
- `videos`: batch, Telegram file ID, original filename, size, duration, status, output URL, error message.
- `events`: batch status history for debugging and user-facing history.

## Batch Statuses

- `draft`: batch exists, waiting for template/videos.
- `receiving`: user is sending videos.
- `settings`: videos received, user can adjust global settings.
- `queued`: waiting for worker.
- `downloading`: worker is downloading Telegram files.
- `validating`: worker is checking format, duration, dimensions, and file health.
- `rendering`: FFmpeg is producing outputs.
- `zipping`: ZIP is being created.
- `uploading`: outputs are being uploaded to storage.
- `delivering`: bot is sending videos/link to Telegram.
- `completed`: all possible outputs delivered.
- `failed`: batch failed with visible error.
- `cancelled`: user cancelled before completion.

## Rendering Behavior

Default global settings:

- Output format: MP4, H.264 video, AAC audio.
- Canvas: 1080x1920, Instagram Reels 9:16.
- Fit mode: cover crop to 9:16.
- Auto cut: enabled.
- Zoom: 105%.
- Speed: 1.0x.
- Mirror: disabled.
- Trim start: 0.3s.
- Trim end: 0.3s.
- Antiduplication: enabled.
- CTA: enabled when supported by the selected template.
- Watermark: disabled by default unless the template requires it.

Antiduplication should be bounded and explicit. It may apply subtle metadata changes, tiny visual/audio variation, and encoding differences, but should not pretend to guarantee platform bypassing.

## Error Handling

- Reject unsupported files immediately with a clear Telegram message.
- Reject input videos over the configured limit before processing.
- Continue processing other videos if one video fails.
- Mark per-video failures in the live panel.
- If the entire batch fails, keep the error visible and offer `Tentar novamente` when the failure is retryable.
- Never silently skip failed videos in the final summary.

## Operational Constraints

Telegram Bot API constraints influence MVP limits:

- Bot file download via `getFile` is limited, so the MVP assumes input videos normally stay below 20 MB.
- Bot upload/send for videos/documents has a practical 50 MB limit in the official API, so larger generated ZIP files should be delivered through storage links.

Railway constraints:

- Railway local filesystem is ephemeral for normal services.
- Railway persistent volumes exist, but object storage is better for final media delivery and ZIP links.
- FFmpeg should be installed through an explicit Dockerfile or build setup.

## Testing Strategy

- Unit tests for batch state transitions and settings updates.
- Unit tests for FFmpeg command generation.
- Integration test for Telegram update handling with mocked Telegram API.
- Integration test for queue worker using sample small videos.
- Manual smoke test with a real Telegram bot in staging:
  - create batch,
  - choose template,
  - upload multiple videos,
  - adjust zoom globally,
  - process,
  - verify Telegram delivery and ZIP link.

## Out Of Scope For MVP

- Web dashboard.
- User-created templates.
- Per-video settings.
- Instagram publishing automation.
- Payments/credits.
- Team accounts.
- Advanced analytics.
- Long-term media archive beyond a retention window.

## Implementation Defaults

- Use grammY for the Telegram bot.
- Start with one Railway service running both bot and worker with low worker concurrency.
- Use Redis and PostgreSQL as managed Railway services.
- Use S3-compatible object storage for generated files and ZIP delivery.
- Store template definitions in versioned JSON files and template media assets in the repository for the MVP.
- Define the first template as a 1080x1920 composition with fixed top area for avatar/name/handle/headline/CTA and video placed underneath with cover crop.
