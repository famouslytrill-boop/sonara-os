export const blockedAgentActions = [
  "send_email_without_approval",
  "publish_post_without_approval",
  "call_customer_without_consent",
  "send_sms_without_consent",
  "charge_or_refund_money",
  "delete_data_without_recovery_plan",
  "export_private_data",
  "change_permissions",
  "deploy_code",
  "merge_pull_request",
  "run_production_shell_command",
  "access_device_permission_without_consent",
];

export function requiresHumanApproval(actionKey: string) {
  return blockedAgentActions.includes(actionKey) || /delete|export|charge|refund|publish|sms|email|permission/i.test(actionKey);
}
