# File Backed Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load production templates from versioned `assets/templates/*/template.json` folders instead of a hardcoded TypeScript array.

**Architecture:** Keep the existing `TemplateDefinition`, `TEMPLATES`, and `getTemplateById` API for low blast radius. Add a small file-backed loader with `zod` validation and fixture-driven tests.

**Tech Stack:** TypeScript, Node.js filesystem APIs, zod, Vitest, existing Telegram keyboard and renderer integrations.

---

### Task 1: Template Loader Tests

**Files:**
- Modify: `tests/templates/templates.test.ts`
- Modify: `src/templates/templates.ts`

- [ ] Write a failing test that calls `loadTemplatesFromDirectory("tests/fixtures/templates")` and expects sorted template IDs.
- [ ] Write a failing test that invalid fixture JSON throws `Invalid template`.
- [ ] Run `rtk npm test -- tests/templates/templates.test.ts` and confirm failures are due to missing loader behavior.
- [ ] Implement `loadTemplatesFromDirectory(rootDir)` with filesystem reads, JSON parsing, zod validation, and sorting.
- [ ] Run the targeted test and confirm it passes.

### Task 2: Production Template Assets

**Files:**
- Create: `assets/templates/humor-crocodilo/template.json`
- Create: `assets/templates/humor-crocodilo/avatar.svg`
- Create: `assets/templates/humor-crocodilo/preview.svg`
- Modify: `src/templates/templates.ts`
- Test: `tests/templates/templates.test.ts`

- [ ] Add a production template folder for `humor-crocodilo`.
- [ ] Export `TEMPLATES` from `loadTemplatesFromDirectory("assets/templates")`.
- [ ] Add a test that `TEMPLATES` includes `humor-crocodilo`.
- [ ] Run the targeted template tests and confirm they pass.

### Task 3: Bot Integration Regression

**Files:**
- Modify: `tests/bot/keyboards.test.ts`
- Test: `src/bot/keyboards.ts`

- [ ] Add or update a keyboard test proving real loaded templates are shown as inline buttons.
- [ ] Keep `templateKeyboard()` API unchanged.
- [ ] Run `rtk npm test -- tests/bot/keyboards.test.ts tests/templates/templates.test.ts`.

### Task 4: Documentation And Verification

**Files:**
- Modify: `README.md`

- [ ] Document the file-backed template folder structure.
- [ ] Run `rtk npm run build`.
- [ ] Run `rtk npm run test:unit`.
- [ ] Run `rtk npm run test:coverage`.
- [ ] Run `rtk git diff --check`.
