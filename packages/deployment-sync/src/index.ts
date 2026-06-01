import { createDeploymentSyncReport } from "./report-builder.ts";

export { checkAuthSync } from "./auth-sync-check.ts";
export {
  appBasePath,
  canonicalAppRoutes,
  canonicalDomain,
  canonicalPublicBaseUrl,
  canonicalPublicRoutes,
  createDomainStatus,
  optionalAppAlias
} from "./domain-config.ts";
export { checkDockerSync } from "./docker-sync-check.ts";
export {
  deploymentEnvRequirements,
  hasDangerousPublicSecretName,
  isEnvConfigured,
  redactEnvValue,
  validateDeploymentEnv
} from "./env-validator.ts";
export { checkGitHubSync } from "./github-sync-check.ts";
export { checkPaywallSync } from "./paywall-sync-check.ts";
export { checkRancherSync } from "./rancher-sync-check.ts";
export { createDeploymentSyncReport, makeFinding, summarizeStatus } from "./report-builder.ts";
export { checkSecuritySync } from "./security-sync-check.ts";
export { checkStripeSync } from "./stripe-sync-check.ts";
export { checkSupabaseSync } from "./supabase-sync-check.ts";
export { checkVercelSync } from "./vercel-sync-check.ts";
export type {
  AuthSyncStatus,
  CloudProviderStatus,
  DeploymentCheckResult,
  DeploymentProvider,
  DeploymentSyncContext,
  DeploymentSyncFinding,
  DeploymentSyncReport,
  DeploymentSyncRiskLevel,
  DeploymentSyncStatus,
  DockerSyncStatus,
  DomainConnectionStatus,
  EnvironmentVariableStatus,
  GitHubSyncStatus,
  PaywallSyncStatus,
  RancherSyncStatus,
  SecuritySyncStatus,
  StripeSyncStatus,
  SupabaseSyncStatus,
  VercelSyncStatus
} from "./types.ts";

if (typeof process !== "undefined" && process.argv[1]?.endsWith("index.ts")) {
  console.log(JSON.stringify(createDeploymentSyncReport(), null, 2));
}
