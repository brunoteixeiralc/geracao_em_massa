# Geracao Em Massa Reels

Telegram-first app for bulk Instagram Reels generation.

## MVP Scope

- Fixed templates.
- Up to 50 videos per batch.
- Global settings per batch.
- Live Telegram status panel.
- FFmpeg rendering.
- Turso/libSQL persistence.
- Redis/BullMQ queue.
- S3-compatible result storage.
- Telegram delivery plus ZIP link.

## Local Commands

```bash
npm run build
npm run test:unit
npm run test:coverage
npm audit --audit-level=high
```

## GitHub Workflow

The repository is set up to use GitHub heavily:

- pull requests for every change,
- CI checks for build, unit tests, coverage, and dependency audit,
- CodeQL for JavaScript/TypeScript security analysis,
- Dependabot for npm and GitHub Actions updates,
- issue templates for bugs and features,
- PR checklist for tests and security review.

## Environment

Copy `.env.example` to `.env` locally and fill in real secrets outside Git.

Production secrets should be configured in Railway and GitHub repository secrets only when a workflow truly needs them.
