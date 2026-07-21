# Global Settings Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a complete Telegram review step where all batch settings can be changed globally before processing.

**Architecture:** Extend the existing `BatchSettings` action model, keyboard callbacks, and panel rendering. Keep persistence unchanged because settings are already stored on the batch.

**Tech Stack:** TypeScript, grammY inline keyboards, Vitest, existing workflow/controller patterns.

---

### Task 1: Settings Actions

**Files:**
- Modify: `src/workflow/settings.ts`
- Test: `tests/workflow/settings.test.ts`

- [ ] Add failing tests for `trim_start_delta`, `trim_end_delta`, `toggle_cta`, and `toggle_watermark`.
- [ ] Run the targeted test and confirm it fails because the actions are missing.
- [ ] Add the new `SettingAction` variants and clamp trim values between `0` and `2` seconds.
- [ ] Run the targeted test and confirm it passes.

### Task 2: Review Panel And Keyboard

**Files:**
- Modify: `src/bot/panel.ts`
- Modify: `src/bot/keyboards.ts`
- Test: `tests/bot/panel.test.ts`
- Test: `tests/bot/keyboards.test.ts`

- [ ] Add failing tests that the settings panel is labeled as a batch review and includes video count plus all settings.
- [ ] Add failing tests that the settings keyboard exposes every global control.
- [ ] Update panel copy and keyboard buttons.
- [ ] Run targeted tests and confirm they pass.

### Task 3: Telegram Callback Routing

**Files:**
- Modify: `src/bot/bot.ts`
- Test: `tests/bot/bot.test.ts`

- [ ] Add failing callback tests for trim, CTA, and watermark.
- [ ] Register the new Telegram callback handlers.
- [ ] Run targeted tests and confirm they pass.

### Task 4: Controller Snapshot

**Files:**
- Modify: `tests/bot/batchController.test.ts`

- [ ] Add a test proving final settings are preserved when queueing.
- [ ] If the test already passes with existing controller behavior, keep it as regression coverage.

### Task 5: Verification

**Files:**
- No production changes expected.

- [ ] Run `rtk npm run build`.
- [ ] Run `rtk npm run test:unit`.
- [ ] Run `rtk npm run test:coverage`.
- [ ] Run `rtk git diff --check`.
- [ ] Review git diff and prepare the PR.
