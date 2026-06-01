import type {
  GitHubUpdateFinding,
  GitHubUpdateWatchReport,
  WatchedGitHubRepository
} from "./types.ts";

export type {
  GitHubUpdateFinding,
  GitHubUpdateRecommendation,
  GitHubUpdateRisk,
  GitHubUpdateWatchReport,
  WatchedGitHubRepository
} from "./types.ts";

export const githubUpdateWatcherFeatureFlags = Object.freeze({
  GITHUB_UPDATE_WATCHER_ENABLED: true,
  AUTO_UPDATE_PRODUCTION_DEPENDENCIES: false,
  AUTO_INSTALL_EXTERNAL_REPOS: false,
  AUTO_MERGE_DEPENDENCY_UPDATES: false,
  OWNER_APPROVAL_REQUIRED_FOR_ADOPTION: true
});

export const watchedGitHubRepositories: readonly WatchedGitHubRepository[] = Object.freeze([
  repo("github", "spec-kit", "reference_only", false, false),
  repo("usebruno", "bruno", "internal_admin_tool", true, false),
  repo("cocoindex-io", "cocoindex", "research_only", true, true),
  repo("ruvnet", "ruflo", "research_only", true, true),
  repo("firecrawl", "firecrawl", "research_only", true, true),
  repo("chatwoot", "chatwoot", "internal_admin_tool", true, true),
  repo("frappe", "erpnext", "reference_only", true, true),
  repo("nextcloud", "server", "reference_only", true, true),
  repo("open-jarvis", "OpenJarvis", "research_only", true, true),
  repo("microsoft", "SkillOpt", "research_only", false, true),
  repo("NVlabs", "LongLive", "research_only", true, true),
  repo("GH05TCREW", "pentestagent", "research_only", true, true),
  repo("nasa-gibs", "worldview", "reference_only", true, true)
]);

export function createGitHubUpdateWatchReport(
  generatedAt = new Date().toISOString()
): GitHubUpdateWatchReport {
  const findings = watchedGitHubRepositories.map(createFinding);
  return Object.freeze({
    generatedAt,
    repositories: watchedGitHubRepositories,
    findings: Object.freeze(findings),
    policy: Object.freeze({
      autoInstallExternalRepos: false,
      autoUpdateProductionDependencies: false,
      autoMergeUpdates: false,
      ownerApprovalRequiredForAdoption: true
    })
  });
}

export function requiresOwnerApprovalForRepository(repository: WatchedGitHubRepository): boolean {
  return (
    repository.requiresLicenseReview ||
    repository.requiresSecurityReview ||
    repository.allowedUse !== "reference_only"
  );
}

function createFinding(repository: WatchedGitHubRepository): GitHubUpdateFinding {
  return Object.freeze({
    repo: `${repository.repoOwner}/${repository.repoName}`,
    risk: repository.requiresSecurityReview
      ? "high"
      : repository.requiresLicenseReview
        ? "medium"
        : "low",
    recommendation: requiresOwnerApprovalForRepository(repository)
      ? "needs_owner_approval"
      : "report_only",
    message:
      "Report only. Review releases, license changes, security advisories, and breaking changes before adoption."
  });
}

function repo(
  repoOwner: string,
  repoName: string,
  allowedUse: WatchedGitHubRepository["allowedUse"],
  requiresLicenseReview: boolean,
  requiresSecurityReview: boolean
): WatchedGitHubRepository {
  return Object.freeze({
    repoOwner,
    repoName,
    repoUrl: `https://github.com/${repoOwner}/${repoName}`,
    cadence: "weekly_default",
    allowedUse,
    requiresLicenseReview,
    requiresSecurityReview
  });
}

if (typeof process !== "undefined" && process.argv[1]?.endsWith("index.ts")) {
  console.log(JSON.stringify(createGitHubUpdateWatchReport(), null, 2));
}
