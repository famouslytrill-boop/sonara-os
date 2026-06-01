export type OperationsQueueId =
  | "customer_follow_ups"
  | "review_requests"
  | "billing_alerts"
  | "failed_webhook_alerts"
  | "onboarding_incomplete_alerts"
  | "support_requests"
  | "security_warnings"
  | "reliability_incidents";

export type OperationsQueueStatus = "empty" | "ready" | "needs_owner_review" | "blocked";

export type OperationsRisk = "low" | "medium" | "high" | "critical";

export type PostLaunchActionKind =
  | "create_internal_task"
  | "remind_owner_admin"
  | "draft_message"
  | "update_checklist_status"
  | "flag_missing_info"
  | "retry_safe_webhook_job"
  | "send_customer_facing_message"
  | "publish_offer"
  | "change_payment_link"
  | "change_price"
  | "approve_generated_content"
  | "issue_refund"
  | "change_legal_policy_copy"
  | "change_payout_destination"
  | "remove_owner"
  | "disable_security_gate"
  | "delete_audit_log"
  | "send_legal_notice"
  | "send_deceptive_claim"
  | "publish_fake_review_or_proof";

export type PostLaunchApprovalLevel = "auto_allowed" | "approval_required" | "blocked";

export type PostLaunchPolicyRule = Readonly<{
  actionKind: PostLaunchActionKind;
  approvalLevel: PostLaunchApprovalLevel;
  risk: OperationsRisk;
  label: string;
  reason: string;
}>;

export type OperationsQueue = Readonly<{
  id: OperationsQueueId;
  title: string;
  description: string;
  status: OperationsQueueStatus;
  risk: OperationsRisk;
  count: number;
  nextAction: string;
  actionKind: PostLaunchActionKind;
}>;

export type OperationsSummary = Readonly<{
  totalQueues: number;
  needsOwnerReview: number;
  blockedQueues: number;
  autoAllowedActions: number;
  approvalRequiredActions: number;
  blockedActions: number;
}>;

export const autoAllowedOperationsActions = Object.freeze([
  "create_internal_task",
  "remind_owner_admin",
  "draft_message",
  "update_checklist_status",
  "flag_missing_info",
  "retry_safe_webhook_job"
] satisfies readonly PostLaunchActionKind[]);

export const approvalRequiredOperationsActions = Object.freeze([
  "send_customer_facing_message",
  "publish_offer",
  "change_payment_link",
  "change_price",
  "approve_generated_content",
  "issue_refund",
  "change_legal_policy_copy"
] satisfies readonly PostLaunchActionKind[]);

export const blockedOperationsActions = Object.freeze([
  "change_payout_destination",
  "remove_owner",
  "disable_security_gate",
  "delete_audit_log",
  "send_legal_notice",
  "send_deceptive_claim",
  "publish_fake_review_or_proof"
] satisfies readonly PostLaunchActionKind[]);

export const postLaunchPolicyRules: readonly PostLaunchPolicyRule[] = Object.freeze([
  ...autoAllowedOperationsActions.map((actionKind) =>
    createPolicyRule(
      actionKind,
      "auto_allowed",
      "low",
      humanizeActionKind(actionKind),
      "Allowed because the action is internal, draft-only, or a safe retry without customer contact or payment/security changes."
    )
  ),
  ...approvalRequiredOperationsActions.map((actionKind) =>
    createPolicyRule(
      actionKind,
      "approval_required",
      actionKind === "change_payment_link" ||
        actionKind === "change_price" ||
        actionKind === "issue_refund"
        ? "high"
        : "medium",
      humanizeActionKind(actionKind),
      "Requires explicit owner approval before public messaging, publishing, generated content approval, legal/policy changes, refunds, or payment changes."
    )
  ),
  ...blockedOperationsActions.map((actionKind) =>
    createPolicyRule(
      actionKind,
      "blocked",
      "critical",
      humanizeActionKind(actionKind),
      "Always blocked from routine automation. This action requires separate manual handling outside post-launch autopilot."
    )
  )
]);

export const postLaunchOperationsQueues: readonly OperationsQueue[] = Object.freeze([
  Object.freeze({
    id: "customer_follow_ups",
    title: "Customer follow-ups",
    description: "Draft follow-up tasks for owners without sending messages automatically.",
    status: "needs_owner_review",
    risk: "medium",
    count: 0,
    nextAction: "Review drafted follow-up before any customer contact.",
    actionKind: "send_customer_facing_message"
  }),
  Object.freeze({
    id: "review_requests",
    title: "Review requests",
    description: "Queue review request drafts only after permission and owner approval.",
    status: "needs_owner_review",
    risk: "medium",
    count: 0,
    nextAction: "Approve each review request before sending.",
    actionKind: "send_customer_facing_message"
  }),
  Object.freeze({
    id: "billing_alerts",
    title: "Billing alerts",
    description: "Flag failed billing setup or invoice issues without changing plans or prices.",
    status: "needs_owner_review",
    risk: "high",
    count: 0,
    nextAction: "Review billing issue before payment or price changes.",
    actionKind: "change_price"
  }),
  Object.freeze({
    id: "failed_webhook_alerts",
    title: "Failed webhook alerts",
    description: "Retry safe webhook jobs when payloads are verified and non-destructive.",
    status: "ready",
    risk: "low",
    count: 0,
    nextAction: "Retry safe verified webhook job or create an internal task.",
    actionKind: "retry_safe_webhook_job"
  }),
  Object.freeze({
    id: "onboarding_incomplete_alerts",
    title: "Onboarding incomplete alerts",
    description: "Flag missing setup steps and update checklist status.",
    status: "ready",
    risk: "low",
    count: 0,
    nextAction: "Update setup checklist and remind the owner.",
    actionKind: "update_checklist_status"
  }),
  Object.freeze({
    id: "support_requests",
    title: "Support requests",
    description: "Create internal support tasks and owner reminders.",
    status: "ready",
    risk: "low",
    count: 0,
    nextAction: "Create internal task and assign owner review if customer reply is needed.",
    actionKind: "create_internal_task"
  }),
  Object.freeze({
    id: "security_warnings",
    title: "Security warnings",
    description: "Escalate security warnings and block attempts to disable safety gates.",
    status: "blocked",
    risk: "critical",
    count: 0,
    nextAction: "Escalate to owner/admin; routine automation cannot disable security gates.",
    actionKind: "disable_security_gate"
  }),
  Object.freeze({
    id: "reliability_incidents",
    title: "Reliability incidents",
    description: "Create incident tasks and reminders without claiming automatic recovery.",
    status: "ready",
    risk: "medium",
    count: 0,
    nextAction: "Create internal incident task and remind owner/admin.",
    actionKind: "remind_owner_admin"
  })
]);

export function evaluatePostLaunchAction(actionKind: PostLaunchActionKind): PostLaunchPolicyRule {
  return (
    postLaunchPolicyRules.find((rule) => rule.actionKind === actionKind) ??
    createPolicyRule(
      actionKind,
      "approval_required",
      "high",
      humanizeActionKind(actionKind),
      "Unknown or unclassified post-launch action requires owner approval."
    )
  );
}

export function canRunPostLaunchAction(actionKind: PostLaunchActionKind): boolean {
  return evaluatePostLaunchAction(actionKind).approvalLevel === "auto_allowed";
}

export function requiresOwnerApproval(actionKind: PostLaunchActionKind): boolean {
  return evaluatePostLaunchAction(actionKind).approvalLevel === "approval_required";
}

export function isBlockedPostLaunchAction(actionKind: PostLaunchActionKind): boolean {
  return evaluatePostLaunchAction(actionKind).approvalLevel === "blocked";
}

export function summarizePostLaunchOperations(): OperationsSummary {
  return Object.freeze({
    totalQueues: postLaunchOperationsQueues.length,
    needsOwnerReview: postLaunchOperationsQueues.filter(
      (queue) => queue.status === "needs_owner_review"
    ).length,
    blockedQueues: postLaunchOperationsQueues.filter((queue) => queue.status === "blocked").length,
    autoAllowedActions: autoAllowedOperationsActions.length,
    approvalRequiredActions: approvalRequiredOperationsActions.length,
    blockedActions: blockedOperationsActions.length
  });
}

function createPolicyRule(
  actionKind: PostLaunchActionKind,
  approvalLevel: PostLaunchApprovalLevel,
  risk: OperationsRisk,
  label: string,
  reason: string
): PostLaunchPolicyRule {
  return Object.freeze({ actionKind, approvalLevel, risk, label, reason });
}

function humanizeActionKind(actionKind: string): string {
  return actionKind
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
