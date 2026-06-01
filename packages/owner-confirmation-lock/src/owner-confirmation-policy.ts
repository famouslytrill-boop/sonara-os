import {
  classifyActionCategory,
  classifyActionRisk,
  getOwnerApprovalRequirement
} from "./action-risk-classifier.ts";
import { isAlwaysBlockedActionKey } from "./sensitive-action-registry.ts";
import type {
  BlockedActionReason,
  OwnerConfirmationAction,
  OwnerConfirmationStatus,
  SensitiveActionRecord
} from "./types.ts";

export const ownerConfirmationFeatureFlags = Object.freeze({
  OWNER_CONFIRMATION_LOCK_ENABLED: true,
  HUMAN_APPROVAL_GATES_ENABLED: true,
  AUTO_EXECUTE_HIGH_RISK_ACTIONS: false,
  AUTO_SEND_CUSTOMER_CAMPAIGNS: false,
  AUTO_ISSUE_REFUNDS: false,
  AUTO_CHANGE_PRICING: false,
  AUTO_CHANGE_PAYOUT_SETTINGS: false,
  AUTO_PUBLISH_AI_MEDIA: false,
  AUTO_DELETE_DATA: false
});

export function areHighRiskAutoExecutionFlagsDisabled(): boolean {
  return (
    ownerConfirmationFeatureFlags.AUTO_EXECUTE_HIGH_RISK_ACTIONS === false &&
    ownerConfirmationFeatureFlags.AUTO_SEND_CUSTOMER_CAMPAIGNS === false &&
    ownerConfirmationFeatureFlags.AUTO_ISSUE_REFUNDS === false &&
    ownerConfirmationFeatureFlags.AUTO_CHANGE_PRICING === false &&
    ownerConfirmationFeatureFlags.AUTO_CHANGE_PAYOUT_SETTINGS === false &&
    ownerConfirmationFeatureFlags.AUTO_PUBLISH_AI_MEDIA === false &&
    ownerConfirmationFeatureFlags.AUTO_DELETE_DATA === false
  );
}

export function requiresOwnerConfirmation(action: OwnerConfirmationAction): boolean {
  return getOwnerApprovalRequirement(action) === "owner_review_required";
}

export function createSensitiveActionRecord(
  action: OwnerConfirmationAction,
  status: OwnerConfirmationStatus = "draft",
  createdAt = new Date().toISOString(),
  id = action.id ?? createRecordId("sensitive_action")
): SensitiveActionRecord {
  const approvalRequirement = getOwnerApprovalRequirement(action);
  const blockedReason = getBlockedReason(action);
  return Object.freeze({
    id,
    organization_id: action.organizationId ?? "setup_organization",
    created_by: action.createdBy ?? action.triggeredBy,
    created_at: action.requestedAt ?? createdAt,
    updated_at: createdAt,
    action_category: classifyActionCategory(action),
    action_key: action.actionKey,
    product_area: action.productArea,
    risk_level: classifyActionRisk(action),
    approval_requirement: approvalRequirement,
    approval_status: blockedReason ? "blocked" : status,
    title: redactSensitiveText(action.title),
    description: redactSensitiveText(action.description),
    triggered_by: redactSensitiveText(action.triggeredBy),
    affected_records: Object.freeze(
      (action.affectedRecords ?? []).map((record) => redactSensitiveText(record))
    ),
    public_private_impact:
      action.publicPrivateImpact ?? "Owner review required before impact is applied.",
    money_security_legal_customer_impact:
      action.moneySecurityLegalCustomerImpact ??
      "Potential sensitive impact requires owner confirmation.",
    before_preview: action.beforePreview ? redactSensitiveText(action.beforePreview) : undefined,
    after_preview: action.afterPreview ? redactSensitiveText(action.afterPreview) : undefined,
    generated_content_preview: action.generatedContentPreview
      ? redactSensitiveText(action.generatedContentPreview)
      : undefined,
    blocked_reason: blockedReason,
    expires_at: action.expiresAt,
    metadata: sanitizeMetadata(action.metadata ?? {})
  });
}

export function redactSensitiveText(value: string): string {
  return value
    .replace(/\b(sk|rk|pk)_(live|test)_[A-Za-z0-9]+/g, "[redacted-key]")
    .replace(/\bwhsec_[A-Za-z0-9]+/g, "[redacted-webhook-secret]")
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, "[redacted-number]")
    .replace(
      /\b(bank|routing|payout|webhook|token|secret|api key)\s*[:=]\s*\S+/gi,
      (_match, label: string) => `${label}=[redacted]`
    )
    .trim();
}

export function sanitizeMetadata(
  metadata: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    const normalizedKey = key.toLowerCase();
    if (
      normalizedKey.includes("secret") ||
      normalizedKey.includes("token") ||
      normalizedKey.includes("api_key") ||
      normalizedKey.includes("payout") ||
      normalizedKey.includes("bank")
    ) {
      sanitized[key] = "[redacted]";
      continue;
    }
    sanitized[key] = typeof value === "string" ? redactSensitiveText(value) : value;
  }
  return Object.freeze(sanitized);
}

function getBlockedReason(action: OwnerConfirmationAction): BlockedActionReason | undefined {
  if (!isAlwaysBlockedActionKey(action.actionKey)) {
    return undefined;
  }
  if (action.actionKey === "delete_audit_logs") {
    return "audit_log_deletion_blocked";
  }
  if (action.actionKey === "change_payout_destination") {
    return "payout_destination_change_blocked";
  }
  if (action.actionKey === "disable_security_gates") {
    return "security_gate_disable_blocked";
  }
  if (action.actionKey === "publish_fake_reviews_proof") {
    return "fake_proof_or_review_blocked";
  }
  if (action.actionKey === "send_deceptive_claims") {
    return "deceptive_claim_blocked";
  }
  return "always_blocked";
}

export function createRecordId(prefix: string): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${prefix}_${random}`;
}
