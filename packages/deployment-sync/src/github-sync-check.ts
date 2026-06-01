import type { DeploymentSyncContext, GitHubSyncStatus } from "./types.ts";
import { isEnvConfigured } from "./env-validator.ts";
import { makeFinding, summarizeStatus } from "./sync-utils.ts";

export function checkGitHubSync(context: DeploymentSyncContext = {}): GitHubSyncStatus {
  const env = context.env ?? {};
  const files = context.repoFiles ?? new Set<string>();
  const findings = [
    makeFinding(
      "github",
      isEnvConfigured(env, "GITHUB_REPOSITORY") ? "configured" : "not_configured",
      "medium",
      "github.repository",
      "GITHUB_REPOSITORY identifies the GitHub repository without exposing secrets."
    ),
    makeFinding(
      "github",
      files.has(".github/workflows/ci.yml") ? "configured" : "needs_review",
      "medium",
      "github.ci_workflow",
      "CI workflow should run build, typecheck, tests, and security artifact scan."
    ),
    makeFinding(
      "github",
      "needs_review",
      "medium",
      "github.branch_protection",
      "Protected branch, pull request review, CODEOWNERS, Dependabot, and secret scanning must be verified in GitHub."
    )
  ];
  return Object.freeze({
    provider: "github",
    ...summarizeStatus(findings),
    findings: Object.freeze(findings),
    metadata: Object.freeze({ secretValuesRedacted: true })
  });
}
