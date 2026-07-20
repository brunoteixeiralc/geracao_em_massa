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

Releases are created by pushing semantic version tags to GitHub.

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

Recommended release steps:

1. Create a branch for the version bump.
2. Run `npm version <version> --no-git-tag-version`.
3. Commit `package.json` and `package-lock.json`.
4. Open a pull request.
5. Wait for `Build, Tests, Audit` and `Analyze JavaScript and TypeScript`.
6. Merge the pull request into `main`.
7. Pull `main` locally.
8. Create an annotated tag with `git tag -a v<version> -m "v<version>"`.
9. Push the tag with `git push origin v<version>`.

The `Release` workflow validates the project again before creating the GitHub Release.

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
