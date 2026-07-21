# Global Settings Review Design

## Goal

Improve the Telegram batch flow so every reel batch has a clear review step before processing. All settings are global to the current batch: if the user changes zoom, speed, trims, CTA, watermark, mirror, auto cut, or antiduplication, the final values apply to every video in that batch.

## Scope

- Keep the flow Telegram-first.
- Keep the existing fixed templates.
- Keep processing asynchronous through the worker.
- Do not add per-video settings in this phase.
- Do not add a web UI.

## User Flow

1. User creates a batch with `/novo`.
2. User selects a fixed template.
3. User sends videos in bulk.
4. User taps `Finalizar envio`.
5. Bot shows a review panel with template, video count, and every global setting.
6. User adjusts values with inline buttons.
7. User taps `Processar lote`.
8. The current settings are saved with the queued batch and used by the worker for all videos.

## Telegram Controls

The settings keyboard should expose all global controls that already exist in the batch settings model:

- Zoom decrease/increase.
- Speed decrease/increase.
- Trim start decrease/increase.
- Trim end decrease/increase.
- Toggle mirror.
- Toggle auto cut.
- Toggle antiduplication.
- Toggle CTA.
- Toggle watermark.
- Process batch.
- Cancel batch.

## Data Model

No database migration is required. `BatchSettings` already contains the fields needed for this phase. The implementation only needs to expose missing actions and preserve the settings snapshot when the batch moves to `queued`.

## Error Handling

- If the user tries to change settings before finalizing uploads, keep the existing receiving prompt.
- If the user tries to process before the batch is in settings/review, keep workflow validation in `startProcessing`.
- Settings changes should be clamped to safe ranges.

## Testing

Unit tests should cover:

- New settings actions for trim, CTA, and watermark.
- Settings keyboard includes all global controls.
- Batch panel renders a review summary with video count and all settings.
- Bot callback routes invoke the correct setting actions.
- Controller preserves the final settings when queueing the batch.
