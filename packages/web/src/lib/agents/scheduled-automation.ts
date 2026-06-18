export type ScheduledAutomationPolicy = Readonly<{
  hiddenScheduledTasksAllowed: false;
  productionActionsAllowed: false;
  requiresUserVisibleSchedule: true;
  requiresAuditLog: true;
  allowedDraftActions: readonly string[];
  blockedActions: readonly string[];
}>;

export const scheduledAutomationPolicy: ScheduledAutomationPolicy = Object.freeze({
  hiddenScheduledTasksAllowed: false,
  productionActionsAllowed: false,
  requiresUserVisibleSchedule: true,
  requiresAuditLog: true,
  allowedDraftActions: Object.freeze([
    "draft_checklist",
    "refresh_metadata",
    "prepare_review_summary"
  ]),
  blockedActions: Object.freeze([
    "send_email",
    "send_sms",
    "call_customer",
    "charge_or_refund",
    "delete_data",
    "change_permissions",
    "deploy_code"
  ])
});
