# GitHub Workflow

## Repository Setup

After pushing this repository to GitHub:

1. Enable Dependabot alerts and Dependabot security updates.
2. Enable CodeQL/code scanning only if the repository supports GitHub Code Security.
3. Configure branch protection or rulesets for `main`.
4. Require these checks before merge:
   - `Build, Tests, Audit`
5. Require pull request reviews before merge.
6. Require conversation resolution before merge.
7. Disable force-pushes and branch deletion on `main`.

## CodeQL

CodeQL is kept in `.github/workflows/codeql.yml`, but it is manual for now.

Reason: GitHub code scanning can upload CodeQL results only when code scanning is enabled for the repository. For private repositories, this generally requires GitHub Code Security on a supported organization or plan.

Until code scanning is available, do not require `Analyze JavaScript and TypeScript` in the `main` ruleset. Require only `Build, Tests, Audit`.

When code scanning is enabled:

1. Open `.github/workflows/codeql.yml`.
2. Add the `pull_request`, `push`, and `schedule` triggers back.
3. Run the workflow once.
4. Add `Analyze JavaScript and TypeScript` as a required status check.

## Daily Development Flow

1. Create an issue for the work.
2. Create a branch from the issue.
3. Implement with unit tests first.
4. Open a pull request.
5. Wait for CI and Dependabot/security checks.
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
