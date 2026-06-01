import type {
  ApprovalLevel,
  AutomationActionKind,
  AutomationPolicyRule,
  AutomationRiskLabel
} from "./types.ts";

export const autoSafeActionKinds = Object.freeze([
  "create_internal_task",
  "draft_message",
  "update_setup_checklist",
  "flag_missing_info",
  "generate_non_public_recommendation",
  "queue_reminder_draft"
] satisfies readonly AutomationActionKind[]);

export const ownerReviewActionKinds = Object.freeze([
  "send_customer_message",
  "publish_offer",
  "change_pricing",
  "update_payment_link",
  "send_review_request",
  "send_campaign",
  "approve_generated_media",
  "update_legal_policy_copy",
  "sync_external_connection"
] satisfies readonly AutomationActionKind[]);

export const blockedActionKinds = Object.freeze([
  "legal_notice",
  "refund_without_approval",
  "delete_customer_data",
  "change_owner_role",
  "send_high_stakes_advice",
  "disable_security_feature",
  "change_payout_destination",
  "publish_fake_proof_or_review",
  "bypass_compliance_warning"
] satisfies readonly AutomationActionKind[]);

export const safeAutomationPolicyRules: readonly AutomationPolicyRule[] = Object.freeze([
  ...autoSafeActionKinds.map((actionKind) =>
    createRule(
      actionKind,
      "auto_safe",
      "low",
      humanizeActionKind(actionKind),
      "Internal setup or draft-only action. No customer contact, payment change, publishing, or data deletion."
    )
  ),
  ...ownerReviewActionKinds.map((actionKind) =>
    createRule(
      actionKind,
      "owner_review",
      actionKind === "change_pricing" || actionKind === "update_payment_link" ? "high" : "medium",
      humanizeActionKind(actionKind),
      "Requires owner review before contacting customers, publishing, changing payment setup, or altering public/legal copy."
    )
  ),
  ...blockedActionKinds.map((actionKind) =>
    createRule(
      actionKind,
      "blocked",
      "critical",
      humanizeActionKind(actionKind),
      "Blocked by policy. This action cannot run through routine automation."
    )
  )
]);

export function evaluateAutomationAction(actionKind: AutomationActionKind): AutomationPolicyRule {
  return (
    safeAutomationPolicyRules.find((rule) => rule.actionKind === actionKind) ??
    createRule(
      actionKind,
      "admin_review",
      "high",
      humanizeActionKind(actionKind),
      "Unknown or sensitive automation action requires admin review."
    )
  );
}

export function canRunWithoutApproval(actionKind: AutomationActionKind): boolean {
  return evaluateAutomationAction(actionKind).approvalLevel === "auto_safe";
}

export function requiresHumanApproval(actionKind: AutomationActionKind): boolean {
  const approvalLevel = evaluateAutomationAction(actionKind).approvalLevel;
  return approvalLevel === "owner_review" || approvalLevel === "admin_review";
}

export function isBlockedAutomationAction(actionKind: AutomationActionKind): boolean {
  return evaluateAutomationAction(actionKind).approvalLevel === "blocked";
}

function createRule(
  actionKind: AutomationActionKind,
  approvalLevel: ApprovalLevel,
  risk: AutomationRiskLabel,
  label: string,
  reason: string
): AutomationPolicyRule {
  return Object.freeze({ actionKind, approvalLevel, risk, label, reason });
}

function humanizeActionKind(actionKind: AutomationActionKind): string {
  return actionKind
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
