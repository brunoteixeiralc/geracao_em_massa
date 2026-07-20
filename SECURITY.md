# Security Policy

## Reporting A Vulnerability

Do not open a public issue for secrets, leaked tokens, authentication bypasses, file-processing exploits, or infrastructure vulnerabilities.

Use GitHub private vulnerability reporting if it is enabled for the repository. If it is not enabled yet, contact the repository maintainer directly and include:

- affected area,
- reproduction steps,
- impact,
- sanitized logs,
- suggested fix when available.

## Secret Handling

Never commit real values for:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `TURSO_AUTH_TOKEN`
- S3 access keys
- signed media URLs
- Telegram file download URLs

## Supported Version

The MVP is pre-release. Security fixes apply to the `main` branch until releases are introduced.
