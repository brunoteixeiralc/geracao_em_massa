# File Backed Templates Design

## Goal

Replace the hardcoded MVP template list with versioned template folders committed to GitHub. The bot should list real templates from `assets/templates/*/template.json`, while tests should use isolated fixtures instead of depending on production template data.

## Scope

- Store fixed templates in the repository.
- Keep templates reviewed through normal GitHub PRs and CI.
- Keep the Telegram user flow unchanged: `/novo`, choose template, send videos, review settings, process.
- Keep this phase limited to the current profile/header plus video layout.
- Do not add Telegram template creation yet.
- Do not add Turso-backed template administration yet.

## Template Folder Shape

```txt
assets/templates/
  humor-crocodilo/
    template.json
    avatar.svg
    preview.svg
```

`template.json` contains the template identity, display metadata, preview path, canvas size, video box, and header data:

```json
{
  "id": "humor-crocodilo",
  "name": "Humor Crocodilo",
  "previewPath": "assets/templates/humor-crocodilo/preview.svg",
  "canvas": { "width": 1080, "height": 1920 },
  "videoBox": { "x": 90, "y": 620, "width": 900, "height": 1120 },
  "header": {
    "avatarPath": "assets/templates/humor-crocodilo/avatar.svg",
    "displayName": "Humor do Crocodilo",
    "handle": "@humordocrocodilo",
    "headline": "Se voce e fa de Humor, ja era pra estar nos seguindo."
  }
}
```

## Loader

`src/templates/templates.ts` keeps the public API used by the bot and worker:

- `TemplateDefinition`
- `TEMPLATES`
- `getTemplateById(id)`

Internally it should:

- read every `template.json` under `assets/templates/*`;
- validate data with `zod`;
- sort templates by name for stable Telegram button order;
- fail fast during import if a production template is invalid;
- provide a testable `loadTemplatesFromDirectory(rootDir)` helper for fixtures.

## Testing

Tests should cover:

- loading multiple templates from fixture folders;
- sorting templates by name;
- rejecting invalid template JSON;
- resolving `getTemplateById`;
- Telegram keyboard still listing loaded templates.

## Runtime

No database migration is required. Existing batches keep storing only `templateId`. Worker lookup remains by ID.

Docker already copies the repository into `/app`, so committed `assets/templates` are available in Railway at runtime.
