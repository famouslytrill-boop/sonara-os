import type { AuthSyncStatus, DeploymentSyncContext } from "./types.ts";
import { makeFinding, summarizeStatus } from "./sync-utils.ts";

export function checkAuthSync(context: DeploymentSyncContext = {}): AuthSyncStatus {
  void context;
  const findings = [
    makeFinding("auth", "configured", "low", "auth.public_routes", "Public routes remain public."),
    makeFinding(
      "auth",
      "needs_review",
      "high",
      "auth.app_routes",
      "Canonical /app routes should require auth in production."
    ),
    makeFinding(
      "auth",
      "needs_review",
      "high",
      "auth.admin_routes",
      "Admin routes must require owner/admin role."
    ),
    makeFinding(
      "auth",
      "needs_review",
      "high",
      "auth.owner_only",
      "Critical owner routes and actions require owner-only confirmation."
    ),
    makeFinding(
      "auth",
      "needs_review",
      "medium",
      "auth.redirects",
      "Auth redirects must include sonaraindustries.com and local development URLs."
    )
  ];
  return Object.freeze({
    provider: "auth",
    ...summarizeStatus(findings),
    findings: Object.freeze(findings),
    metadata: Object.freeze({ mfaPasskeyReadinessDocumented: true })
  });
}
