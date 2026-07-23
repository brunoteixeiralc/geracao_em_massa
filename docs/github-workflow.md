# GitHub Workflow

## Repository Setup

After pushing this repository to GitHub:

1. Enable Dependabot alerts and Dependabot security updates.
2. Enable CodeQL/code scanning.
3. Configure branch protection or rulesets for `main`.
4. Require these checks before merge:
   - `Build, Tests, Audit`
   - `Analyze JavaScript and TypeScript`
5. Require pull request reviews before merge.
6. Require conversation resolution before merge.
7. Disable force-pushes and branch deletion on `main`.

## CodeQL

CodeQL runs through `.github/workflows/codeql.yml`.

It is configured to run on:

- pull requests to `main`;
- pushes to `main`;
- a weekly scheduled scan;
- manual runs through `workflow_dispatch`.

Because the repository is public and code scanning is enabled, require `Analyze JavaScript and TypeScript` in the `main` ruleset.

## Daily Development Flow

1. Create an issue for the work.
2. Create a branch from the issue.
3. Implement with unit tests first.
4. Open a pull request.
5. Wait for CI, CodeQL, and Dependabot/security checks.
6. Merge only after checks are green and review is complete.

## Release Flow

Releases are created automatically after a merge to `main` brings a new semantic version in `package.json`.

Tag format:

```text
v0.1.0
v0.2.0
v1.0.0
v1.0.0-beta.1
```

The tag version must match `package.json` without the leading `v`. For example, tag `v0.1.0` requires:

```json
{
  "version": "0.1.0"
}
```

Recommended release steps through GitHub Actions:

1. Open `Actions`.
2. Select `Prepare Release PR`.
3. Click `Run workflow`.
4. Enter the version, for example `0.8.0` or `v0.8.0`.
5. Let the workflow create `release/v<version>`, bump `package.json` and `package-lock.json`, open a pull request, and trigger CI plus CodeQL.
6. Wait for `Build, Tests, Audit` and `Analyze JavaScript and TypeScript`.
7. Merge the pull request into `main`.
8. Let `.github/workflows/auto-release.yml` create `v<version>` and the GitHub Release.

For the workflow to open pull requests, enable this repository setting once:
`Settings > Actions > General > Workflow permissions > Allow GitHub Actions to create and approve pull requests`.

Manual fallback:

1. Create a branch for the version bump.
2. Run `npm version <version> --no-git-tag-version`.
3. Commit `package.json` and `package-lock.json`.
4. Open a pull request.
5. Wait for `Build, Tests, Audit` and `Analyze JavaScript and TypeScript`.
6. Merge the pull request into `main`.
7. Let `.github/workflows/auto-release.yml` create `v<version>` and the GitHub Release.

The auto-release workflow runs `npm ci`, TypeScript build, unit tests, coverage, and `npm audit --audit-level=high` before creating the tag. If the tag already exists, it skips release creation without failing.

The `.github/workflows/release.yml` workflow remains as a fallback for semantic tags created manually. Manual tags still must match the current `package.json` version.

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
