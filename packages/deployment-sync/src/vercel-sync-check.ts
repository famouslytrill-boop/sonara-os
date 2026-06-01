import type { DeploymentSyncContext, VercelSyncStatus } from "./types.ts";
import { isEnvConfigured } from "./env-validator.ts";
import { makeFinding, summarizeStatus } from "./sync-utils.ts";

export function checkVercelSync(context: DeploymentSyncContext = {}): VercelSyncStatus {
  const env = context.env ?? {};
  const findings = [
    makeFinding(
      "vercel",
      isEnvConfigured(env, "VERCEL_PROJECT_ID") ? "configured" : "not_configured",
      "high",
      "vercel.project",
      "VERCEL_PROJECT_ID must be configured before claiming Vercel project connection."
    ),
    makeFinding(
      "vercel",
      isEnvConfigured(env, "VERCEL_ORG_ID") ? "configured" : "not_configured",
      "medium",
      "vercel.org",
      "VERCEL_ORG_ID must be configured for production sync checks."
    ),
    makeFinding(
      "vercel",
      "needs_review",
      "high",
      "vercel.domain_ssl",
      "Domain, SSL, production branch, preview env, redirects, and deployment protection require manual Vercel verification."
    ),
    makeFinding(
      "vercel",
      "configured",
      "low",
      "vercel.security_headers",
      "Static build generates a _headers artifact; hosting-specific enforcement still needs Vercel review."
    )
  ];
  return Object.freeze({
    provider: "vercel",
    ...summarizeStatus(findings),
    findings: Object.freeze(findings),
    metadata: Object.freeze({ productionDomain: "sonaraindustries.com" })
  });
}
