export type GitHubWatchCadence = "daily_optional" | "weekly_default";
export type GitHubUpdateRisk = "low" | "medium" | "high" | "critical" | "unknown";
export type GitHubUpdateRecommendation =
  | "report_only"
  | "review_release_notes"
  | "needs_owner_approval"
  | "needs_security_review"
  | "blocked";

export type WatchedGitHubRepository = Readonly<{
  repoOwner: string;
  repoName: string;
  repoUrl: string;
  cadence: GitHubWatchCadence;
  allowedUse: "research_only" | "reference_only" | "internal_admin_tool" | "blocked";
  requiresLicenseReview: boolean;
  requiresSecurityReview: boolean;
}>;

export type GitHubUpdateFinding = Readonly<{
  repo: string;
  risk: GitHubUpdateRisk;
  recommendation: GitHubUpdateRecommendation;
  message: string;
}>;

export type GitHubUpdateWatchReport = Readonly<{
  generatedAt: string;
  repositories: readonly WatchedGitHubRepository[];
  findings: readonly GitHubUpdateFinding[];
  policy: Readonly<{
    autoInstallExternalRepos: false;
    autoUpdateProductionDependencies: false;
    autoMergeUpdates: false;
    ownerApprovalRequiredForAdoption: true;
  }>;
}>;
