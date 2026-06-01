import { checkAuthSync } from "./auth-sync-check.ts";
import {
  canonicalAppRoutes,
  canonicalDomain,
  canonicalPublicBaseUrl,
  canonicalPublicRoutes,
  createDomainStatus
} from "./domain-config.ts";
import { checkDockerSync } from "./docker-sync-check.ts";
import { validateDeploymentEnv } from "./env-validator.ts";
import { checkGitHubSync } from "./github-sync-check.ts";
import { checkPaywallSync } from "./paywall-sync-check.ts";
import { checkRancherSync } from "./rancher-sync-check.ts";
import { checkSecuritySync } from "./security-sync-check.ts";
import { checkStripeSync } from "./stripe-sync-check.ts";
import { checkSupabaseSync } from "./supabase-sync-check.ts";
import type { DeploymentSyncContext, DeploymentSyncReport } from "./types.ts";
import { checkVercelSync } from "./vercel-sync-check.ts";
export { makeFinding, summarizeStatus } from "./sync-utils.ts";

export function createDeploymentSyncReport(
  context: DeploymentSyncContext = {}
): DeploymentSyncReport {
  const now = context.now ?? new Date();
  const statuses = Object.freeze({
    domain: createDomainStatus(context),
    environment: validateDeploymentEnv(context),
    github: checkGitHubSync(context),
    vercel: checkVercelSync(context),
    supabase: checkSupabaseSync(context),
    stripe: checkStripeSync(context),
    docker: checkDockerSync(context),
    rancher: checkRancherSync(context),
    auth: checkAuthSync(context),
    paywall: checkPaywallSync(context),
    security: checkSecuritySync(context)
  });
  const findings = Object.freeze(Object.values(statuses).flatMap((status) => status.findings));
  const blockers = Object.freeze(
    findings.filter((finding) => finding.status === "blocked" || finding.riskLevel === "critical")
  );
  return Object.freeze({
    generatedAt: now.toISOString(),
    canonicalDomain,
    publicBaseUrl: canonicalPublicBaseUrl,
    appBasePath: "/app",
    publicRoutes: canonicalPublicRoutes,
    appRoutes: canonicalAppRoutes,
    statuses,
    findings,
    blockers,
    summary: Object.freeze({
      totalFindings: findings.length,
      blockers: blockers.length,
      needsReview: findings.filter((finding) => finding.status === "needs_review").length,
      configured: findings.filter((finding) => finding.status === "configured").length,
      verified: findings.filter((finding) => finding.status === "verified").length,
      skippedForMvp: findings.filter((finding) => finding.status === "skipped_for_mvp").length
    })
  });
}
