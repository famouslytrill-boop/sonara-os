import type { DeploymentSyncContext, SecuritySyncStatus } from "./types.ts";
import { makeFinding, summarizeStatus } from "./sync-utils.ts";

export function checkSecuritySync(context: DeploymentSyncContext = {}): SecuritySyncStatus {
  const files = context.repoFiles ?? new Set<string>();
  const findings = [
    makeFinding(
      "security",
      files.has("scripts/security-headers.mjs") ? "configured" : "needs_review",
      "medium",
      "security.headers",
      "Security headers and CSP baseline must be generated and enforced by the host."
    ),
    makeFinding(
      "security",
      files.has("scripts/security-scan-artifacts.mjs") ? "configured" : "needs_review",
      "medium",
      "security.source_leak_scan",
      "Source leak prevention scan should run before deployment."
    ),
    makeFinding(
      "security",
      "configured",
      "low",
      "security.open_source_intake",
      "Open-Source Intake Registry exists for external project review."
    ),
    makeFinding(
      "security",
      "needs_review",
      "high",
      "security.secret_exposure",
      "Client bundles must be scanned for service-role, Stripe secret, database URL, AI provider key, webhook secret, and token exposure."
    ),
    makeFinding(
      "security",
      "configured",
      "low",
      "security.owner_confirmation",
      "Legal/policy publishing, customer campaigns, delete actions, proof/review publishing, and sensitive automation require owner approval."
    ),
    makeFinding(
      "security",
      "configured",
      "low",
      "security.audit_log_deletion",
      "Audit log deletion is blocked by policy."
    )
  ];
  return Object.freeze({
    provider: "security",
    ...summarizeStatus(findings),
    findings: Object.freeze(findings),
    metadata: Object.freeze({ secretsRedacted: true })
  });
}

if (typeof process !== "undefined" && process.argv[1]?.endsWith("security-sync-check.ts")) {
  console.log(JSON.stringify(checkSecuritySync(), null, 2));
}
