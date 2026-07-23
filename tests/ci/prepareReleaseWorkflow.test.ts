import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const workflowPath = join(process.cwd(), ".github", "workflows", "prepare-release.yml");
const ciWorkflowPath = join(process.cwd(), ".github", "workflows", "ci.yml");
const codeqlWorkflowPath = join(process.cwd(), ".github", "workflows", "codeql.yml");

describe("prepare-release workflow", () => {
  test("creates a version bump pull request from a manual GitHub Actions run", () => {
    expect(existsSync(workflowPath)).toBe(true);

    const workflow = readFileSync(workflowPath, "utf8");

    expect(workflow).toContain("name: Prepare Release PR");
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("version:");
    expect(workflow).toContain("actions: write");
    expect(workflow).toContain("contents: write");
    expect(workflow).toContain("pull-requests: write");
    expect(workflow).toContain("ref: main");
    expect(workflow).toContain("node-version: 22");
    expect(workflow).not.toContain("actions/permissions/workflow");
    expect(workflow).toContain('BRANCH_EXISTS="false"');
    expect(workflow).toContain("branch_exists=${BRANCH_EXISTS}");
    expect(workflow).toContain("already exists. Skipping version bump");
    expect(workflow).toContain("gh pr list");
    expect(workflow).toContain("Pull request already exists");
    expect(workflow).toContain("should_trigger_checks=false");
    expect(workflow).toContain("should_trigger_checks=true");
    expect(workflow).toContain("if: steps.pull-request.outputs.should_trigger_checks == 'true'");
    expect(workflow).toContain("Allow GitHub Actions to create and approve pull requests");
    expect(workflow).toContain('TAG_NAME="v${VERSION}"');
    expect(workflow).toContain('BRANCH_NAME="release/${TAG_NAME}"');
    expect(workflow).toContain("git ls-remote --exit-code --tags origin");
    expect(workflow).toContain("git ls-remote --exit-code --heads origin");
    expect(workflow).toContain('npm version "${VERSION}" --no-git-tag-version');
    expect(workflow).toContain("gh pr create");
    expect(workflow).not.toContain("git tag -a");
    expect(workflow).toContain("gh workflow run ci.yml");
    expect(workflow).toContain("gh workflow run codeql.yml");
    expect(readFileSync(ciWorkflowPath, "utf8")).toContain("workflow_dispatch:");
    expect(readFileSync(codeqlWorkflowPath, "utf8")).toContain("workflow_dispatch:");
  });
});
