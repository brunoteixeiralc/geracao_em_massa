# GitHub Workflow

## Repository Setup

After pushing this repository to GitHub:

1. Enable Dependabot alerts and Dependabot security updates.
2. Enable CodeQL/code scanning if it is not automatically enabled by the workflow.
3. Configure branch protection or rulesets for `main`.
4. Require these checks before merge:
   - `Build, Tests, Audit`
   - `Analyze JavaScript and TypeScript`
5. Require pull request reviews before merge.
6. Require conversation resolution before merge.
7. Disable force-pushes and branch deletion on `main`.

## Daily Development Flow

1. Create an issue for the work.
2. Create a branch from the issue.
3. Implement with unit tests first.
4. Open a pull request.
5. Wait for CI, CodeQL, and Dependabot/security checks.
6. Merge only after checks are green and review is complete.

## Secrets

Keep secrets out of Git. Use Railway variables for runtime values:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `REDIS_URL`
- S3 credentials

Use GitHub repository secrets only for GitHub Actions jobs that need direct access to external services. The default CI workflow does not need production secrets.

## Recommended Labels

- `bug`
- `enhancement`
- `security`
- `dependencies`
- `github-actions`
- `telegram`
- `ffmpeg`
- `database`
- `deploy`
