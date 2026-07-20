# Instagram Reels Telegram Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an MVP Telegram bot that creates bulk Instagram Reels from fixed templates, up to 50 videos per batch, global batch settings, live Telegram status, and delivery through Telegram plus ZIP link.

**Architecture:** Use a TypeScript Node.js service with clean internal boundaries: bot adapter, workflow service, renderer planning, worker, storage, and persistence. Start with one Railway deployable service that can run webhook handling and a low-concurrency worker, while keeping modules split so bot and worker can become separate services after sustained processing load appears.

**Tech Stack:** Node.js, TypeScript, grammY, BullMQ, Redis, Turso/libSQL, SQLite migrations, FFmpeg, Vitest, S3-compatible object storage, Docker, Railway.

---

## File Structure

- `package.json`: npm scripts and dependencies.
- `tsconfig.json`: TypeScript configuration.
- `vitest.config.ts`: test runner configuration.
- `.env.example`: required environment variables.
- `.gitignore`: generated files and secrets.
- `Dockerfile`: Railway deploy image with FFmpeg installed.
- `src/index.ts`: app entrypoint.
- `src/config/env.ts`: environment parsing and validation.
- `src/bot/bot.ts`: grammY bot construction.
- `src/bot/keyboards.ts`: inline keyboard builders.
- `src/bot/panel.ts`: live Telegram panel rendering.
- `src/workflow/status.ts`: batch and video status constants.
- `src/workflow/settings.ts`: default settings and setting update rules.
- `src/workflow/batchWorkflow.ts`: batch state transition rules.
- `src/templates/templates.ts`: fixed MVP template definitions.
- `src/renderer/ffmpegPlan.ts`: pure FFmpeg argument planning.
- `src/queue/queue.ts`: BullMQ queue setup.
- `src/worker/processBatch.ts`: processing orchestration.
- `src/storage/storage.ts`: S3-compatible storage interface.
- `src/db/client.ts`: Turso/libSQL client.
- `src/db/migrate.ts`: lightweight SQL migration runner.
- `db/migrations/001_initial_schema.sql`: SQLite-compatible database schema.
- `tests/workflow/settings.test.ts`: settings tests.
- `tests/workflow/batchWorkflow.test.ts`: workflow tests.
- `tests/bot/panel.test.ts`: panel rendering tests.
- `tests/renderer/ffmpegPlan.test.ts`: FFmpeg planning tests.

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `src/index.ts`

- [ ] **Step 1: Create package metadata and scripts**

Create `package.json`:

```json
{
  "name": "geracao-em-massa-reels",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:migrate": "tsx src/db/migrate.ts"
  },
  "dependencies": {
    "@aws-sdk/client-s3": "^3.614.0",
    "@aws-sdk/s3-request-presigner": "^3.614.0",
    "@grammyjs/runner": "^2.0.3",
    "@libsql/client": "^0.17.4",
    "archiver": "^7.0.1",
    "bullmq": "^5.12.12",
    "dotenv": "^16.4.5",
    "grammy": "^1.28.0",
    "ioredis": "^5.4.1",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^20.14.12",
    "tsx": "^4.16.2",
    "typescript": "^5.5.4",
    "vitest": "^2.0.4"
  }
}
```

- [ ] **Step 2: Add TypeScript config**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": ".",
    "types": ["node", "vitest/globals"]
  },
  "include": ["src", "tests", "vitest.config.ts"],
  "exclude": ["dist", "node_modules"]
}
```

- [ ] **Step 3: Add Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["tests/**/*.test.ts"]
  }
});
```

- [ ] **Step 4: Add local environment files**

Create `.gitignore`:

```gitignore
node_modules
dist
.env
.DS_Store
tmp
coverage
```

Create `.env.example`:

```env
NODE_ENV=development
TELEGRAM_BOT_TOKEN=replace_me
TURSO_DATABASE_URL=libsql://database-org.turso.io
TURSO_AUTH_TOKEN=replace_me
REDIS_URL=redis://localhost:6379
S3_ENDPOINT=https://example.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=reels-output
S3_ACCESS_KEY_ID=replace_me
S3_SECRET_ACCESS_KEY=replace_me
PUBLIC_ASSET_BASE_URL=https://files.example.com
WORK_DIR=/tmp/reels-bot
MAX_BATCH_VIDEOS=50
MAX_INPUT_BYTES=20971520
MAX_TELEGRAM_SEND_BYTES=52428800
WORKER_CONCURRENCY=1
```

- [ ] **Step 5: Add minimal entrypoint**

Create `src/index.ts`:

```ts
console.log("Reels bot service booted");
```

- [ ] **Step 6: Install dependencies**

Run: `npm install`

Expected: `package-lock.json` is created and npm exits successfully.

- [ ] **Step 7: Verify scaffold**

Run: `npm run build`

Expected: TypeScript compiles without errors and creates `dist/index.js`.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts .gitignore .env.example src/index.ts
git commit -m "chore: scaffold reels bot service"
```

## Task 2: Environment Validation

**Files:**
- Create: `src/config/env.ts`
- Modify: `src/index.ts`
- Test: `tests/config/env.test.ts`

- [ ] **Step 1: Write failing env tests**

Create `tests/config/env.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseEnv } from "../../src/config/env.js";

describe("parseEnv", () => {
  it("parses valid environment values", () => {
    const env = parseEnv({
      NODE_ENV: "test",
      TELEGRAM_BOT_TOKEN: "token",
      TURSO_DATABASE_URL: "file:/tmp/reels-bot-test.db",
      TURSO_AUTH_TOKEN: "token",
      REDIS_URL: "redis://localhost:6379",
      S3_ENDPOINT: "https://storage.example.com",
      S3_REGION: "auto",
      S3_BUCKET: "bucket",
      S3_ACCESS_KEY_ID: "key",
      S3_SECRET_ACCESS_KEY: "secret",
      PUBLIC_ASSET_BASE_URL: "https://files.example.com",
      WORK_DIR: "/tmp/reels-bot",
      MAX_BATCH_VIDEOS: "50",
      MAX_INPUT_BYTES: "20971520",
      MAX_TELEGRAM_SEND_BYTES: "52428800",
      WORKER_CONCURRENCY: "1"
    });

    expect(env.maxBatchVideos).toBe(50);
    expect(env.maxInputBytes).toBe(20 * 1024 * 1024);
  });

  it("rejects missing required values", () => {
    expect(() => parseEnv({})).toThrow("Invalid environment");
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- tests/config/env.test.ts`

Expected: FAIL because `src/config/env.ts` does not exist.

- [ ] **Step 3: Implement env parser**

Create `src/config/env.ts`:

```ts
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TURSO_DATABASE_URL: z.string().min(1),
  TURSO_AUTH_TOKEN: z.string().min(1),
  REDIS_URL: z.string().startsWith("redis"),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  PUBLIC_ASSET_BASE_URL: z.string().url(),
  WORK_DIR: z.string().min(1).default("/tmp/reels-bot"),
  MAX_BATCH_VIDEOS: z.coerce.number().int().positive().max(50).default(50),
  MAX_INPUT_BYTES: z.coerce.number().int().positive().default(20 * 1024 * 1024),
  MAX_TELEGRAM_SEND_BYTES: z.coerce.number().int().positive().default(50 * 1024 * 1024),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().max(3).default(1)
});

export type AppEnv = ReturnType<typeof parseEnv>;

export function parseEnv(source: NodeJS.ProcessEnv) {
  const result = schema.safeParse(source);

  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid environment: ${fields}`);
  }

  return {
    nodeEnv: result.data.NODE_ENV,
    telegramBotToken: result.data.TELEGRAM_BOT_TOKEN,
    tursoDatabaseUrl: result.data.TURSO_DATABASE_URL,
    tursoAuthToken: result.data.TURSO_AUTH_TOKEN,
    redisUrl: result.data.REDIS_URL,
    s3Endpoint: result.data.S3_ENDPOINT,
    s3Region: result.data.S3_REGION,
    s3Bucket: result.data.S3_BUCKET,
    s3AccessKeyId: result.data.S3_ACCESS_KEY_ID,
    s3SecretAccessKey: result.data.S3_SECRET_ACCESS_KEY,
    publicAssetBaseUrl: result.data.PUBLIC_ASSET_BASE_URL,
    workDir: result.data.WORK_DIR,
    maxBatchVideos: result.data.MAX_BATCH_VIDEOS,
    maxInputBytes: result.data.MAX_INPUT_BYTES,
    maxTelegramSendBytes: result.data.MAX_TELEGRAM_SEND_BYTES,
    workerConcurrency: result.data.WORKER_CONCURRENCY
  };
}
```

- [ ] **Step 4: Wire entrypoint**

Modify `src/index.ts`:

```ts
import "dotenv/config";
import { parseEnv } from "./config/env.js";

const env = parseEnv(process.env);

console.log(`Reels bot service booted in ${env.nodeEnv}`);
```

- [ ] **Step 5: Verify**

Run: `npm test -- tests/config/env.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/config/env.ts src/index.ts tests/config/env.test.ts
git commit -m "chore: validate service environment"
```

## Task 3: Domain Statuses, Templates, and Settings

**Files:**
- Create: `src/workflow/status.ts`
- Create: `src/workflow/settings.ts`
- Create: `src/templates/templates.ts`
- Test: `tests/workflow/settings.test.ts`

- [ ] **Step 1: Write failing settings tests**

Create `tests/workflow/settings.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_BATCH_SETTINGS, updateSetting } from "../../src/workflow/settings.js";

describe("batch settings", () => {
  it("uses the MVP defaults", () => {
    expect(DEFAULT_BATCH_SETTINGS).toMatchObject({
      autoCut: true,
      zoomPercent: 105,
      speed: 1,
      mirror: false,
      trimStartSeconds: 0.3,
      trimEndSeconds: 0.3,
      antiduplication: true,
      cta: true,
      watermark: false
    });
  });

  it("updates zoom globally within bounds", () => {
    const settings = updateSetting(DEFAULT_BATCH_SETTINGS, { type: "zoom_delta", delta: 5 });
    expect(settings.zoomPercent).toBe(110);
  });

  it("toggles mirror globally", () => {
    const settings = updateSetting(DEFAULT_BATCH_SETTINGS, { type: "toggle_mirror" });
    expect(settings.mirror).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- tests/workflow/settings.test.ts`

Expected: FAIL because workflow files do not exist.

- [ ] **Step 3: Add statuses**

Create `src/workflow/status.ts`:

```ts
export const BATCH_STATUSES = [
  "draft",
  "receiving",
  "settings",
  "queued",
  "downloading",
  "validating",
  "rendering",
  "zipping",
  "uploading",
  "delivering",
  "completed",
  "failed",
  "cancelled"
] as const;

export type BatchStatus = (typeof BATCH_STATUSES)[number];

export const VIDEO_STATUSES = ["received", "queued", "downloading", "rendering", "ready", "delivered", "failed"] as const;

export type VideoStatus = (typeof VIDEO_STATUSES)[number];
```

- [ ] **Step 4: Add settings rules**

Create `src/workflow/settings.ts`:

```ts
export type BatchSettings = {
  autoCut: boolean;
  zoomPercent: number;
  speed: number;
  mirror: boolean;
  trimStartSeconds: number;
  trimEndSeconds: number;
  antiduplication: boolean;
  cta: boolean;
  watermark: boolean;
};

export const DEFAULT_BATCH_SETTINGS: BatchSettings = {
  autoCut: true,
  zoomPercent: 105,
  speed: 1,
  mirror: false,
  trimStartSeconds: 0.3,
  trimEndSeconds: 0.3,
  antiduplication: true,
  cta: true,
  watermark: false
};

export type SettingAction =
  | { type: "zoom_delta"; delta: number }
  | { type: "speed_delta"; delta: number }
  | { type: "toggle_mirror" }
  | { type: "toggle_auto_cut" }
  | { type: "toggle_antiduplication" };

export function updateSetting(settings: BatchSettings, action: SettingAction): BatchSettings {
  switch (action.type) {
    case "zoom_delta":
      return { ...settings, zoomPercent: clamp(settings.zoomPercent + action.delta, 100, 130) };
    case "speed_delta":
      return { ...settings, speed: clamp(roundOneDecimal(settings.speed + action.delta), 0.8, 1.3) };
    case "toggle_mirror":
      return { ...settings, mirror: !settings.mirror };
    case "toggle_auto_cut":
      return { ...settings, autoCut: !settings.autoCut };
    case "toggle_antiduplication":
      return { ...settings, antiduplication: !settings.antiduplication };
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function roundOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}
```

- [ ] **Step 5: Add fixed templates**

Create `src/templates/templates.ts`:

```ts
export type TemplateDefinition = {
  id: string;
  name: string;
  previewPath: string;
  canvas: { width: number; height: number };
  videoBox: { x: number; y: number; width: number; height: number };
  header: {
    avatarPath: string;
    displayName: string;
    handle: string;
    headline: string;
  };
};

export const TEMPLATES: TemplateDefinition[] = [
  {
    id: "humor-01",
    name: "Humor 01",
    previewPath: "assets/templates/humor-01/preview.png",
    canvas: { width: 1080, height: 1920 },
    videoBox: { x: 90, y: 620, width: 900, height: 1120 },
    header: {
      avatarPath: "assets/templates/humor-01/avatar.png",
      displayName: "HUMOR DE CACHORRO",
      handle: "@humordecachorro",
      headline: "Meu maior arrependimento foi nao ter seguido essa pagina antes kkk"
    }
  }
];

export function getTemplateById(id: string): TemplateDefinition | undefined {
  return TEMPLATES.find((template) => template.id === id);
}
```

- [ ] **Step 6: Verify**

Run: `npm test -- tests/workflow/settings.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/workflow/status.ts src/workflow/settings.ts src/templates/templates.ts tests/workflow/settings.test.ts
git commit -m "feat: add batch settings and templates"
```

## Task 4: Batch Workflow Rules

**Files:**
- Create: `src/workflow/batchWorkflow.ts`
- Test: `tests/workflow/batchWorkflow.test.ts`

- [ ] **Step 1: Write failing workflow tests**

Create `tests/workflow/batchWorkflow.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_BATCH_SETTINGS } from "../../src/workflow/settings.js";
import { createDraftBatch, receiveVideo, selectTemplate, startProcessing } from "../../src/workflow/batchWorkflow.js";

describe("batch workflow", () => {
  it("creates a draft batch", () => {
    const batch = createDraftBatch({ id: "batch-1", telegramUserId: "123" });
    expect(batch.status).toBe("draft");
    expect(batch.settings).toEqual(DEFAULT_BATCH_SETTINGS);
  });

  it("moves to receiving after template selection", () => {
    const batch = selectTemplate(createDraftBatch({ id: "batch-1", telegramUserId: "123" }), "humor-01");
    expect(batch.status).toBe("receiving");
    expect(batch.templateId).toBe("humor-01");
  });

  it("accepts up to the configured batch limit", () => {
    let batch = selectTemplate(createDraftBatch({ id: "batch-1", telegramUserId: "123" }), "humor-01");
    batch = receiveVideo(batch, { id: "video-1", fileId: "file-1", fileName: "one.mp4", sizeBytes: 1000 }, 1);
    expect(batch.videos).toHaveLength(1);
    expect(() =>
      receiveVideo(batch, { id: "video-2", fileId: "file-2", fileName: "two.mp4", sizeBytes: 1000 }, 1)
    ).toThrow("Batch video limit reached");
  });

  it("queues a batch with videos", () => {
    let batch = selectTemplate(createDraftBatch({ id: "batch-1", telegramUserId: "123" }), "humor-01");
    batch = receiveVideo(batch, { id: "video-1", fileId: "file-1", fileName: "one.mp4", sizeBytes: 1000 }, 50);
    batch = startProcessing(batch);
    expect(batch.status).toBe("queued");
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- tests/workflow/batchWorkflow.test.ts`

Expected: FAIL because `batchWorkflow.ts` does not exist.

- [ ] **Step 3: Implement workflow**

Create `src/workflow/batchWorkflow.ts`:

```ts
import type { BatchStatus, VideoStatus } from "./status.js";
import { type BatchSettings, DEFAULT_BATCH_SETTINGS } from "./settings.js";

export type BatchVideo = {
  id: string;
  fileId: string;
  fileName: string;
  sizeBytes: number;
  status: VideoStatus;
};

export type Batch = {
  id: string;
  telegramUserId: string;
  status: BatchStatus;
  templateId: string | null;
  settings: BatchSettings;
  videos: BatchVideo[];
};

export function createDraftBatch(input: { id: string; telegramUserId: string }): Batch {
  return {
    id: input.id,
    telegramUserId: input.telegramUserId,
    status: "draft",
    templateId: null,
    settings: DEFAULT_BATCH_SETTINGS,
    videos: []
  };
}

export function selectTemplate(batch: Batch, templateId: string): Batch {
  if (batch.status !== "draft") {
    throw new Error(`Cannot select template while batch is ${batch.status}`);
  }

  return { ...batch, templateId, status: "receiving" };
}

export function receiveVideo(
  batch: Batch,
  video: Omit<BatchVideo, "status">,
  maxBatchVideos: number
): Batch {
  if (batch.status !== "receiving") {
    throw new Error(`Cannot receive video while batch is ${batch.status}`);
  }

  if (batch.videos.length >= maxBatchVideos) {
    throw new Error("Batch video limit reached");
  }

  return {
    ...batch,
    videos: [...batch.videos, { ...video, status: "received" }]
  };
}

export function openSettings(batch: Batch): Batch {
  if (batch.status !== "receiving") {
    throw new Error(`Cannot open settings while batch is ${batch.status}`);
  }

  if (batch.videos.length === 0) {
    throw new Error("Cannot process an empty batch");
  }

  return { ...batch, status: "settings" };
}

export function startProcessing(batch: Batch): Batch {
  const settingsBatch = batch.status === "settings" ? batch : openSettings(batch);
  return { ...settingsBatch, status: "queued" };
}
```

- [ ] **Step 4: Verify**

Run: `npm test -- tests/workflow/batchWorkflow.test.ts`

Expected: PASS.

Run: `npm test`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/workflow/batchWorkflow.ts tests/workflow/batchWorkflow.test.ts
git commit -m "feat: add batch workflow rules"
```

## Task 5: Live Telegram Panel Rendering

**Files:**
- Create: `src/bot/panel.ts`
- Create: `src/bot/keyboards.ts`
- Test: `tests/bot/panel.test.ts`

- [ ] **Step 1: Write failing panel tests**

Create `tests/bot/panel.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createDraftBatch, receiveVideo, selectTemplate } from "../../src/workflow/batchWorkflow.js";
import { renderBatchPanel } from "../../src/bot/panel.js";

describe("renderBatchPanel", () => {
  it("shows receiving progress", () => {
    let batch = selectTemplate(createDraftBatch({ id: "522", telegramUserId: "123" }), "humor-01");
    batch = receiveVideo(batch, { id: "v1", fileId: "f1", fileName: "one.mp4", sizeBytes: 1000 }, 50);

    expect(renderBatchPanel(batch)).toContain("Videos: 1/50 recebidos");
  });

  it("shows global settings", () => {
    const batch = selectTemplate(createDraftBatch({ id: "522", telegramUserId: "123" }), "humor-01");
    expect(renderBatchPanel({ ...batch, status: "settings" })).toContain("Zoom: 105%");
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- tests/bot/panel.test.ts`

Expected: FAIL because `src/bot/panel.ts` does not exist.

- [ ] **Step 3: Implement panel renderer**

Create `src/bot/panel.ts`:

```ts
import type { Batch } from "../workflow/batchWorkflow.js";

const MAX_BATCH_VIDEOS = 50;

export function renderBatchPanel(batch: Batch): string {
  const lines = [`Lote #${batch.id}`, `Status: ${labelStatus(batch.status)}`];

  if (batch.templateId) {
    lines.push(`Template: ${batch.templateId}`);
  }

  if (batch.status === "receiving") {
    lines.push(`Videos: ${batch.videos.length}/${MAX_BATCH_VIDEOS} recebidos`);
  }

  if (batch.status === "settings") {
    lines.push("");
    lines.push("Ajustes do lote");
    lines.push(`Corte automatico: ${onOff(batch.settings.autoCut)}`);
    lines.push(`Zoom: ${batch.settings.zoomPercent}%`);
    lines.push(`Velocidade: ${batch.settings.speed.toFixed(1)}x`);
    lines.push(`Espelhar: ${onOff(batch.settings.mirror)}`);
    lines.push(`Cortar inicio: ${batch.settings.trimStartSeconds.toFixed(1)}s`);
    lines.push(`Cortar fim: ${batch.settings.trimEndSeconds.toFixed(1)}s`);
    lines.push(`Antiduplicidade: ${onOff(batch.settings.antiduplication)}`);
    lines.push(`CTA: ${onOff(batch.settings.cta)}`);
    lines.push(`Marca d'agua: ${onOff(batch.settings.watermark)}`);
  }

  if (["queued", "downloading", "validating", "rendering", "zipping", "uploading", "delivering"].includes(batch.status)) {
    const ready = batch.videos.filter((video) => video.status === "ready" || video.status === "delivered").length;
    lines.push(`Progresso: ${ready}/${batch.videos.length} videos`);
  }

  if (batch.status === "completed") {
    lines.push(`${batch.videos.length} Reels prontos`);
  }

  if (batch.status === "failed") {
    lines.push("Falha no lote. Verifique os itens marcados com erro.");
  }

  return lines.join("\n");
}

function labelStatus(status: Batch["status"]) {
  const labels: Record<Batch["status"], string> = {
    draft: "Rascunho",
    receiving: "Recebendo videos",
    settings: "Ajustes",
    queued: "Na fila",
    downloading: "Baixando videos",
    validating: "Validando arquivos",
    rendering: "Renderizando",
    zipping: "Criando ZIP",
    uploading: "Enviando arquivos",
    delivering: "Entregando resultados",
    completed: "Concluido",
    failed: "Falhou",
    cancelled: "Cancelado"
  };

  return labels[status];
}

function onOff(value: boolean) {
  return value ? "ligado" : "desligado";
}
```

- [ ] **Step 4: Implement keyboard builders**

Create `src/bot/keyboards.ts`:

```ts
import { InlineKeyboard } from "grammy";
import { TEMPLATES } from "../templates/templates.js";

export function templateKeyboard() {
  const keyboard = new InlineKeyboard();
  for (const template of TEMPLATES) {
    keyboard.text(template.name, `template:${template.id}`).row();
  }
  keyboard.text("Cancelar lote", "batch:cancel");
  return keyboard;
}

export function receivingKeyboard() {
  return new InlineKeyboard().text("Finalizar envio", "batch:settings").row().text("Cancelar lote", "batch:cancel");
}

export function settingsKeyboard() {
  return new InlineKeyboard()
    .text("Zoom -", "settings:zoom:-5")
    .text("Zoom +", "settings:zoom:5")
    .row()
    .text("Vel -", "settings:speed:-0.1")
    .text("Vel +", "settings:speed:0.1")
    .row()
    .text("Espelhar on/off", "settings:mirror")
    .row()
    .text("Processar lote", "batch:process")
    .row()
    .text("Cancelar lote", "batch:cancel");
}
```

- [ ] **Step 5: Verify**

Run: `npm test -- tests/bot/panel.test.ts`

Expected: PASS.

Run: `npm test`

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/bot/panel.ts src/bot/keyboards.ts tests/bot/panel.test.ts
git commit -m "feat: render telegram batch panel"
```

## Task 6: FFmpeg Command Planning

**Files:**
- Create: `src/renderer/ffmpegPlan.ts`
- Test: `tests/renderer/ffmpegPlan.test.ts`

- [ ] **Step 1: Write failing FFmpeg plan tests**

Create `tests/renderer/ffmpegPlan.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { TEMPLATES } from "../../src/templates/templates.js";
import { DEFAULT_BATCH_SETTINGS } from "../../src/workflow/settings.js";
import { buildFfmpegArgs } from "../../src/renderer/ffmpegPlan.js";

describe("buildFfmpegArgs", () => {
  it("builds a 9:16 mp4 render command", () => {
    const args = buildFfmpegArgs({
      inputPath: "/tmp/in.mp4",
      outputPath: "/tmp/out.mp4",
      template: TEMPLATES[0],
      settings: DEFAULT_BATCH_SETTINGS
    });

    expect(args).toContain("-i");
    expect(args).toContain("/tmp/in.mp4");
    expect(args).toContain("-filter_complex");
    expect(args).toContain("-c:v");
    expect(args).toContain("libx264");
    expect(args).toContain("/tmp/out.mp4");
  });

  it("adds horizontal flip when mirror is enabled", () => {
    const args = buildFfmpegArgs({
      inputPath: "/tmp/in.mp4",
      outputPath: "/tmp/out.mp4",
      template: TEMPLATES[0],
      settings: { ...DEFAULT_BATCH_SETTINGS, mirror: true }
    });

    expect(args.join(" ")).toContain("hflip");
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- tests/renderer/ffmpegPlan.test.ts`

Expected: FAIL because `src/renderer/ffmpegPlan.ts` does not exist.

- [ ] **Step 3: Implement FFmpeg planning**

Create `src/renderer/ffmpegPlan.ts`:

```ts
import type { TemplateDefinition } from "../templates/templates.js";
import type { BatchSettings } from "../workflow/settings.js";

export type FfmpegPlanInput = {
  inputPath: string;
  outputPath: string;
  template: TemplateDefinition;
  settings: BatchSettings;
};

export function buildFfmpegArgs(input: FfmpegPlanInput): string[] {
  const { template, settings } = input;
  const scaleFactor = settings.zoomPercent / 100;
  const scaledWidth = Math.round(template.videoBox.width * scaleFactor);
  const scaledHeight = Math.round(template.videoBox.height * scaleFactor);
  const filters = [
    `[0:v]trim=start=${settings.trimStartSeconds},setpts=${speedSetPts(settings.speed)},scale=${scaledWidth}:${scaledHeight}:force_original_aspect_ratio=increase,crop=${template.videoBox.width}:${template.videoBox.height}`
  ];

  if (settings.mirror) {
    filters[0] += ",hflip";
  }

  filters[0] += `[video]`;

  return [
    "-y",
    "-i",
    input.inputPath,
    "-filter_complex",
    filters.join(";"),
    "-map",
    "[video]",
    "-map",
    "0:a?",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    "-shortest",
    input.outputPath
  ];
}

function speedSetPts(speed: number) {
  return `${(1 / speed).toFixed(4)}*PTS`;
}
```

- [ ] **Step 4: Verify**

Run: `npm test -- tests/renderer/ffmpegPlan.test.ts`

Expected: PASS.

Run: `npm test`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/ffmpegPlan.ts tests/renderer/ffmpegPlan.test.ts
git commit -m "feat: plan ffmpeg reels renders"
```

## Task 7: Persistence Schema

**Files:**
- Create: `db/migrations/001_initial_schema.sql`
- Create: `src/db/client.ts`
- Create: `src/db/migrate.ts`

- [ ] **Step 1: Add SQLite schema**

Create `db/migrations/001_initial_schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  telegram_user_id TEXT NOT NULL UNIQUE,
  username TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS batches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  template_id TEXT,
  status TEXT NOT NULL,
  settings_json TEXT NOT NULL,
  status_panel_chat_id TEXT,
  status_panel_message_id TEXT,
  output_zip_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_batches_user_id ON batches(user_id);
CREATE INDEX IF NOT EXISTS idx_batches_status ON batches(status);

CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  telegram_file_id TEXT NOT NULL,
  original_file_name TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  status TEXT NOT NULL,
  output_url TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (batch_id) REFERENCES batches(id)
);

CREATE INDEX IF NOT EXISTS idx_videos_batch_id ON videos(batch_id);
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);

CREATE TABLE IF NOT EXISTS batch_events (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (batch_id) REFERENCES batches(id)
);

CREATE INDEX IF NOT EXISTS idx_batch_events_batch_id ON batch_events(batch_id);
```

- [ ] **Step 2: Add Turso/libSQL client**

Create `src/db/client.ts`:

```ts
import { createClient } from "@libsql/client";
import type { AppEnv } from "../config/env.js";

export function createDbClient(env: Pick<AppEnv, "tursoDatabaseUrl" | "tursoAuthToken">) {
  return createClient({
    url: env.tursoDatabaseUrl,
    authToken: env.tursoAuthToken
  });
}
```

- [ ] **Step 3: Add migration runner**

Create `src/db/migrate.ts`:

```ts
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "../config/env.js";
import { createDbClient } from "./client.js";

const env = parseEnv(process.env);
const db = createDbClient(env);
const rootDir = join(fileURLToPath(new URL("../..", import.meta.url)));
const migrationPath = join(rootDir, "db/migrations/001_initial_schema.sql");
const sql = await readFile(migrationPath, "utf8");

await db.batch(
  sql
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean)
    .map((statement) => ({ sql: statement, args: [] })),
  "write"
);

await db.execute({
  sql: "INSERT OR IGNORE INTO schema_migrations (version) VALUES (?)",
  args: ["001_initial_schema"]
});

console.log("Applied migration 001_initial_schema");
```

- [ ] **Step 4: Run migration against a local SQLite file**

Run:

```bash
TURSO_DATABASE_URL=file:/tmp/reels-bot-plan.db TURSO_AUTH_TOKEN=local TELEGRAM_BOT_TOKEN=test REDIS_URL=redis://localhost:6379 S3_ENDPOINT=https://storage.example.com S3_REGION=auto S3_BUCKET=bucket S3_ACCESS_KEY_ID=key S3_SECRET_ACCESS_KEY=secret PUBLIC_ASSET_BASE_URL=https://files.example.com npm run db:migrate
```

Expected: output contains `Applied migration 001_initial_schema`.

- [ ] **Step 5: Verify build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add db/migrations/001_initial_schema.sql src/db/client.ts src/db/migrate.ts package.json package-lock.json
git commit -m "feat: add turso persistence schema"
```

## Task 8: Queue, Storage, and Worker Skeleton

**Files:**
- Create: `src/queue/queue.ts`
- Create: `src/storage/storage.ts`
- Create: `src/worker/processBatch.ts`

- [ ] **Step 1: Add queue module**

Create `src/queue/queue.ts`:

```ts
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";

export type ProcessBatchJob = {
  batchId: string;
};

export function createRedisConnection(redisUrl: string) {
  return new IORedis(redisUrl, { maxRetriesPerRequest: null });
}

export function createBatchQueue(connection: IORedis) {
  return new Queue<ProcessBatchJob>("batch-processing", { connection });
}

export function createBatchWorker(
  connection: IORedis,
  handler: (job: ProcessBatchJob) => Promise<void>,
  concurrency: number
) {
  return new Worker<ProcessBatchJob>(
    "batch-processing",
    async (job) => handler(job.data),
    { connection, concurrency }
  );
}
```

- [ ] **Step 2: Add storage module**

Create `src/storage/storage.ts`:

```ts
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type StorageConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicAssetBaseUrl: string;
};

export function createStorageClient(config: StorageConfig) {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    },
    forcePathStyle: true
  });

  return {
    async uploadBuffer(key: string, body: Buffer, contentType: string) {
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: body,
          ContentType: contentType
        })
      );

      return `${config.publicAssetBaseUrl.replace(/\/$/, "")}/${key}`;
    },
    async signedPutUrl(key: string, contentType: string) {
      return getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          ContentType: contentType
        }),
        { expiresIn: 3600 }
      );
    }
  };
}
```

- [ ] **Step 3: Add worker skeleton**

Create `src/worker/processBatch.ts`:

```ts
import type { ProcessBatchJob } from "../queue/queue.js";

export async function processBatch(job: ProcessBatchJob) {
  console.log(`Processing batch ${job.batchId}`);
}
```

- [ ] **Step 4: Verify**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/queue/queue.ts src/storage/storage.ts src/worker/processBatch.ts
git commit -m "feat: add queue and worker skeleton"
```

## Task 9: Telegram Bot Adapter

**Files:**
- Create: `src/bot/bot.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Implement bot construction**

Create `src/bot/bot.ts`:

```ts
import { Bot } from "grammy";
import type { Queue } from "bullmq";
import { createDraftBatch } from "../workflow/batchWorkflow.js";
import type { ProcessBatchJob } from "../queue/queue.js";
import { renderBatchPanel } from "./panel.js";
import { templateKeyboard } from "./keyboards.js";

export function createBot(token: string, queue: Queue<ProcessBatchJob>) {
  const bot = new Bot(token);

  bot.command("start", async (ctx) => {
    await ctx.reply("Envie /novo_lote para criar Reels em massa.");
  });

  bot.command("novo_lote", async (ctx) => {
    const telegramUserId = String(ctx.from?.id ?? "unknown");
    const batch = createDraftBatch({ id: String(Date.now()), telegramUserId });
    await ctx.reply(renderBatchPanel(batch), { reply_markup: templateKeyboard() });
  });

  bot.callbackQuery(/^template:/, async (ctx) => {
    await ctx.answerCallbackQuery("Template selecionado. Envie seus videos.");
  });

  bot.callbackQuery("batch:process", async (ctx) => {
    await queue.add("process", { batchId: String(Date.now()) });
    await ctx.answerCallbackQuery("Lote enviado para processamento.");
  });

  return bot;
}
```

- [ ] **Step 2: Wire app startup**

Modify `src/index.ts`:

```ts
import "dotenv/config";
import { parseEnv } from "./config/env.js";
import { createBot } from "./bot/bot.js";
import { createBatchQueue, createBatchWorker, createRedisConnection } from "./queue/queue.js";
import { processBatch } from "./worker/processBatch.js";

const env = parseEnv(process.env);
const redis = createRedisConnection(env.redisUrl);
const queue = createBatchQueue(redis);
const worker = createBatchWorker(redis, processBatch, env.workerConcurrency);
const bot = createBot(env.telegramBotToken, queue);

worker.on("failed", (job, error) => {
  console.error(`Batch job ${job?.id ?? "unknown"} failed`, error);
});

await bot.start();
```

- [ ] **Step 3: Verify**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/bot/bot.ts src/index.ts
git commit -m "feat: add telegram bot adapter"
```

## Task 10: Railway Deployment Files

**Files:**
- Create: `Dockerfile`
- Create: `railway.toml`

- [ ] **Step 1: Add Dockerfile**

Create `Dockerfile`:

```dockerfile
FROM node:20-bookworm-slim AS base

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

CMD ["npm", "run", "start"]
```

- [ ] **Step 2: Add Railway config**

Create `railway.toml`:

```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
startCommand = "npm run start"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
```

- [ ] **Step 3: Verify Docker build locally**

Run this command on a machine with Docker installed: `docker build -t geracao-em-massa-reels .`

Expected: image builds successfully and FFmpeg installation step passes.

- [ ] **Step 4: Commit**

```bash
git add Dockerfile railway.toml
git commit -m "chore: add railway deployment config"
```

## Task 11: End-to-End MVP Completion

**Files:**
- Modify: `src/bot/bot.ts`
- Modify: `src/worker/processBatch.ts`
- Modify: `src/storage/storage.ts`
- Modify: `src/db/client.ts`

- [ ] **Step 1: Implement real batch persistence in bot handlers**

Use the Turso/libSQL client in `src/bot/bot.ts` so `/novo_lote`, template selection, video upload, settings changes, and process action persist batch state instead of using in-memory examples.

- [ ] **Step 2: Implement Telegram video file download in worker**

Use grammY API file metadata and the Telegram file download URL:

```ts
const file = await bot.api.getFile(telegramFileId);
const url = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
```

Reject files above `MAX_INPUT_BYTES` before download when Telegram metadata includes file size.

- [ ] **Step 3: Implement FFmpeg execution**

Use `node:child_process` `spawn` with arguments from `buildFfmpegArgs`. Capture stderr, store failures per video, and continue other videos.

- [ ] **Step 4: Implement ZIP creation**

Use `archiver` to zip rendered MP4 files into `Lote_<batchId>.zip`.

- [ ] **Step 5: Upload outputs and update panel**

Upload each output and the ZIP to storage, update database records, and edit the Telegram panel at phase transitions and every few completed videos.

- [ ] **Step 6: Deliver results**

Send each generated video through Telegram when it is under `MAX_TELEGRAM_SEND_BYTES`; always send the ZIP link at the end.

- [ ] **Step 7: Verify with staging bot**

Run locally with a real bot token, Redis, Turso, and storage variables.

Expected:

```text
/novo_lote creates a live panel
template selection changes the lot to video receiving
multiple videos are accepted
settings apply globally
worker processes every video
Telegram receives small outputs
ZIP link contains all outputs
failed videos remain visible in final panel
```

- [ ] **Step 8: Commit**

```bash
git add src/bot/bot.ts src/worker/processBatch.ts src/storage/storage.ts src/db/client.ts
git commit -m "feat: complete telegram reels mvp"
```

## Self-Review

- Spec coverage: the plan covers Telegram-only interface, fixed templates, up to 50 videos, global settings, live status panel, Railway, FFmpeg rendering, queue, Turso/libSQL, Redis, object storage, Telegram plus ZIP delivery, and visible per-video errors.
- Scope: the MVP remains one product path and excludes web dashboard, custom templates, payments, and Instagram publishing.
- Type consistency: `Batch`, `BatchSettings`, `TemplateDefinition`, and status strings are defined before downstream tasks reference them.
- Risk: Task 11 is intentionally larger than earlier tasks because it binds external APIs and FFmpeg together; execute it in smaller code commits if the implementation reveals useful sub-boundaries.
