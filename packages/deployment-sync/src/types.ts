export type DeploymentProvider =
  | "domain"
  | "github"
  | "vercel"
  | "supabase"
  | "stripe"
  | "docker"
  | "rancher"
  | "auth"
  | "paywall"
  | "security"
  | "environment";

export type DeploymentSyncStatus =
  | "not_configured"
  | "configured"
  | "verified"
  | "needs_review"
  | "blocked"
  | "failed"
  | "skipped_for_mvp";

export type DeploymentSyncRiskLevel = "low" | "medium" | "high" | "critical";

export type DeploymentSyncFinding = Readonly<{
  provider: DeploymentProvider;
  status: DeploymentSyncStatus;
  riskLevel: DeploymentSyncRiskLevel;
  findingKey: string;
  message: string;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type DeploymentCheckResult = Readonly<{
  provider: DeploymentProvider;
  status: DeploymentSyncStatus;
  riskLevel: DeploymentSyncRiskLevel;
  findings: readonly DeploymentSyncFinding[];
  metadata: Readonly<Record<string, unknown>>;
}>;

export type DomainConnectionStatus = DeploymentCheckResult;
export type CloudProviderStatus = DeploymentCheckResult;
export type EnvironmentVariableStatus = DeploymentCheckResult;
export type GitHubSyncStatus = DeploymentCheckResult;
export type VercelSyncStatus = DeploymentCheckResult;
export type SupabaseSyncStatus = DeploymentCheckResult;
export type StripeSyncStatus = DeploymentCheckResult;
export type DockerSyncStatus = DeploymentCheckResult;
export type RancherSyncStatus = DeploymentCheckResult;
export type AuthSyncStatus = DeploymentCheckResult;
export type PaywallSyncStatus = DeploymentCheckResult;
export type SecuritySyncStatus = DeploymentCheckResult;

export type DeploymentSyncContext = Readonly<{
  env?: Readonly<Record<string, string | undefined>>;
  repoFiles?: ReadonlySet<string>;
  now?: Date;
}>;

export type DeploymentSyncReport = Readonly<{
  generatedAt: string;
  canonicalDomain: string;
  publicBaseUrl: string;
  appBasePath: string;
  publicRoutes: readonly string[];
  appRoutes: readonly string[];
  statuses: Readonly<{
    domain: DomainConnectionStatus;
    environment: EnvironmentVariableStatus;
    github: GitHubSyncStatus;
    vercel: VercelSyncStatus;
    supabase: SupabaseSyncStatus;
    stripe: StripeSyncStatus;
    docker: DockerSyncStatus;
    rancher: RancherSyncStatus;
    auth: AuthSyncStatus;
    paywall: PaywallSyncStatus;
    security: SecuritySyncStatus;
  }>;
  findings: readonly DeploymentSyncFinding[];
  blockers: readonly DeploymentSyncFinding[];
  summary: Readonly<{
    totalFindings: number;
    blockers: number;
    needsReview: number;
    configured: number;
    verified: number;
    skippedForMvp: number;
  }>;
}>;
