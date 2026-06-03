import { canApproveDeployment } from "./deploymentApproval.ts";
import { missingRequiredEnv } from "./environmentValidation.ts";
import type { LaunchReadinessInput } from "./contracts.ts";
export const launchChecklistSections = [
  "domain_dns",
  "supabase",
  "auth",
  "storage",
  "payment_provider",
  "webhooks",
  "email_sms_provider",
  "monitoring",
  "backups",
  "rollback",
  "legal_public_copy_review",
  "accessibility_check",
  "trust_shield_review"
] as const;
export function evaluateLaunchReadiness(input: LaunchReadinessInput) {
  const missing = missingRequiredEnv(input.env);
  const allowed =
    missing.length === 0 &&
    !input.serviceRoleClientExposure &&
    canApproveDeployment(input.approval);
  return { allowed, missing, reason: allowed ? "launch_review_complete" : "launch_blocked" };
}
