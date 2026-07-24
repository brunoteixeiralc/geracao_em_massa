# Bulk Reels Generator

Telegram-first app for generating Instagram Reels in bulk.

This project replaces a traditional web interface with a direct Telegram workflow: send a batch of videos, choose a reusable template, apply global settings to the whole batch, follow live processing status, and receive the finished Reels through Telegram, including a ZIP file for downloading everything at once.

## Purpose

Build a fast, safe, and easy-to-operate system for bulk Reels generation.

Main scope:

- vertical Reels only;
- reusable fixed templates;
- input videos usually up to 20 MB each;
- batches with up to 50 videos;
- global settings applied to the whole batch;
- live Telegram status panel;
- server-side processing;
- Redis/BullMQ queue for batch processing;
- separate worker for downloading Telegram files and rendering with FFmpeg;
- Turso/libSQL persistence;
- Railway deployment;
- individual Telegram delivery and final `.zip` delivery;
- unit tests prioritized from the MVP stage.

## Telegram Flow

1. The user starts a new batch in the Telegram bot.
2. The bot shows the active template or lets the user choose another fixed template.
3. The user sends the videos for the batch.
4. The bot validates quantity, size, and real file type.
5. The user reviews global settings such as zoom, speed, trimming, mirroring, CTA, watermark, and antiduplication.
6. The bot saves the batch state in Turso and sends the job to the queue.
7. The worker downloads the original Telegram files to `WORK_DIR`.
8. The worker validates local paths and renders the videos with FFprobe/FFmpeg.
9. The worker creates the ZIP, uploads MP4s/ZIP to S3-compatible storage, and saves URLs in Turso.
10. The bot delivers the finished Reels when they fit Telegram limits and always sends the final `.zip` link.

Initial commands:

- `/start` shows the initial bot message.
- `/novo` creates a new batch and starts template selection.
- `/templates` lists available templates with preview images.
- `/status` shows the active or most recent batch, including the ZIP when available.

During a batch, the bot uses inline buttons for template selection, finishing upload, changing global settings, cancelling, and submitting the job to the queue.

## Safe Antiduplication

The antiduplication option applies lightweight deterministic technical variations per video. The goal is to keep the final Reels clean and faithful to the template while giving each rendered file a different technical signature.

When enabled, FFmpeg:

- removes inherited metadata and chapters from the original file;
- standardizes the final video to 30 FPS;
- normalizes SAR with `setsar=1`;
- applies tiny brightness, contrast, and saturation variations;
- injects very light visual noise before template composition;
- varies CRF and GOP inside a conservative range;
- resamples audio to 48 kHz and applies a subtle volume/frequency mask when audio exists;
- still accepts videos without audio through `0:a?`.

When disabled, rendering skips these extra variation steps.

## Current Status

The MVP technical foundation is already prepared:

- typed environment configuration;
- Telegram trusted-user access control;
- input media validation;
- batch status and progress model;
- global settings rules per batch;
- fixed initial templates;
- live Telegram status panel rendering and updates;
- BullMQ queue for batch jobs;
- worker for Telegram downloads and local MP4 rendering;
- shell-free FFprobe/FFmpeg executor for 9:16 Reels;
- ZIP packaging for rendered videos;
- S3/R2 upload for MP4s and ZIPs;
- final Telegram delivery with individual videos and ZIP link;
- initial Turso/libSQL database schema;
- persistence repositories;
- unit tests for core rules;
- GitHub workflows for CI, dependency audit, releases, and CodeQL.

## Tech Stack

| Library | Role | Why it is used |
| --- | --- | --- |
| `grammy` | Telegram bot | Modern typed Telegram framework for commands, inline buttons, and bot responses. |
| `@grammyjs/runner` | Bot execution | Improves runtime control, concurrency, and graceful shutdown. |
| `fastify` | HTTP server | Fast and lightweight server for Telegram webhooks, health checks, and Railway routes. |
| `@fastify/helmet` | Security headers | Adds safer HTTP headers by default. |
| `@fastify/rate-limit` | Abuse protection | Reduces spam, loops, and basic endpoint abuse. |
| `@libsql/client` | Turso database | Official libSQL/Turso-compatible SDK for batches, videos, events, and results. |
| `bullmq` | Job queue | Handles asynchronous batch processing, retries, and separation between bot and worker. |
| `ioredis` | Redis connection | Redis client used by BullMQ in production. |
| `@aws-sdk/client-s3` | Storage | Uploads generated files to S3-compatible storage such as Cloudflare R2 or AWS S3. |
| `@aws-sdk/s3-request-presigner` | Temporary URLs | Creates signed links for large file or ZIP delivery. |
| `archiver` | ZIP packaging | Creates the final `.zip` file with all Reels from the batch. |
| `file-type` | File validation | Detects the real file type from binary signatures instead of trusting the file name. |
| `zod` | Data validation | Validates environment variables, payloads, and settings with clear errors and safe types. |
| `dotenv` | Local environment | Loads `.env` during local development without committing secrets. |
| `nanoid` | Internal IDs | Generates short secure IDs for batches, jobs, and files. |
| `pino` | Logging | Fast structured logger suited for Railway and production debugging. |
| `typescript` | Codebase | Reduces development-time errors and improves maintainability. |
| `tsx` | Local TS execution | Runs TypeScript scripts locally, including server and migrations. |
| `vitest` | Unit tests | Fast TypeScript-friendly test runner for protecting app behavior. |
| `@vitest/coverage-v8` | Coverage | Generates V8-based coverage reports integrated with Vitest. |

## Security Decisions

- The bot only accepts users listed in `TRUSTED_TELEGRAM_USER_IDS`.
- The webhook uses `TELEGRAM_WEBHOOK_SECRET` to reduce fake calls.
- Files are validated by size and real binary type, not just extension.
- Secrets stay out of Git and should live in local `.env`, Railway variables, or GitHub secrets.
- HTTP endpoints are protected with rate limiting.
- Safer HTTP headers are applied through `@fastify/helmet`.
- Download URLs should be temporary when generated by S3-compatible storage.
- The pipeline should fail visibly when Turso, Redis, storage, Telegram, or FFmpeg are unavailable.

See [SECURITY.md](./SECURITY.md) for vulnerability reporting and secret-handling rules.

## Quality And Tests

The project prioritizes unit tests from the MVP. The main goal is to protect rules that could cause lost batches, invalid files, incorrect rendering, broken delivery, or misleading status panels.

Main commands:

```bash
npm run build
npm run start
npm run start:worker
npm run test:unit
npm run test:coverage
npm run templates:validate
npm run templates:smoke
npm audit --audit-level=high
```

GitHub CI runs build, unit tests, template validation, coverage, and dependency audit.

## Templates

Each template lives in `assets/templates/<id>/template.json` and references the assets used during rendering.

Before committing a new template, run:

```bash
npm run templates:validate
```

This validates:

- `template.json` schema;
- `previewPath`, `framePath`, or `avatarPath` existence;
- PNG dimensions matching the template `canvas`;
- `videoBox` inside the canvas;
- minimum `keyColor` coverage for `kind: "frame"` templates.

To run a local FFmpeg smoke test:

```bash
npm run templates:smoke
```

This creates a short synthetic video and tries to render every template using the same rendering plan used by the worker.

## Local Development

Use Node.js 22 or newer.

Install dependencies:

```bash
npm install
```

Copy the example environment file:

```bash
cp .env.example .env
```

Fill `.env` with real local values.

Main environment variables:

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Application environment. |
| `PORT` | HTTP port used by Fastify. |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from BotFather. |
| `TELEGRAM_WEBHOOK_SECRET` | Secret sent by Telegram in webhook requests. |
| `TRUSTED_TELEGRAM_USER_IDS` | Authorized Telegram user IDs. |
| `PUBLIC_WEBHOOK_BASE_URL` | Public Railway URL used for webhook setup. |
| `TURSO_DATABASE_URL` | Turso/libSQL database URL. |
| `TURSO_AUTH_TOKEN` | Turso access token. |
| `REDIS_URL` | Redis URL used by BullMQ. |
| `S3_ENDPOINT` | S3-compatible storage endpoint. |
| `S3_REGION` | Storage region. |
| `S3_BUCKET` | Bucket where generated Reels are stored. |
| `S3_ACCESS_KEY_ID` | Storage access key. |
| `S3_SECRET_ACCESS_KEY` | Storage secret key. |
| `PUBLIC_ASSET_BASE_URL` | Public/base URL for file delivery. |
| `WORK_DIR` | Private local processing folder. Default: `.data/reels-bot`. |
| `MAX_BATCH_VIDEOS` | Maximum videos per batch. |
| `MAX_INPUT_BYTES` | Maximum input size per video. |
| `MAX_TELEGRAM_SEND_BYTES` | Maximum size for direct Telegram delivery. |
| `WORKER_CONCURRENCY` | Number of jobs processed in parallel. |

## Database

The project uses Turso, based on libSQL/SQLite.

Run migrations:

```bash
npm run db:migrate
```

The initial schema creates tables for:

- batches;
- batch videos;
- status events;
- generated results.

## Railway Deployment

Railway hosts two processes:

- `web`: Telegram webhook server and health checks;
- `worker`: background renderer and delivery pipeline.

Expected setup:

- environment variables configured in Railway;
- Turso available through `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`;
- Redis available for BullMQ;
- S3/R2 storage configured for generated files;
- `WORK_DIR` pointing to a private container folder outside `/tmp`;
- Docker deployment using the included `Dockerfile`, which installs `ffmpeg` and `ffprobe`;
- HTTP health check exposed by Fastify.

Web process:

```bash
npm run build
npm run start
```

Worker process:

```bash
npm run build
npm run start:worker
```

## Repository Automation

The repository uses GitHub workflows for:

- CI checks;
- test coverage;
- template validation;
- dependency audit;
- CodeQL analysis;
- release preparation;
- automatic release/tag generation from `package.json`.

Dependabot is configured to keep dependencies and GitHub Actions updated.
