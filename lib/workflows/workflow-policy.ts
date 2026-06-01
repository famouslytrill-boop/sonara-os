export const workflowPolicy = {
  durableExecutionEnabledByDefault: false,
  requirePreviewForHighRiskActions: true,
  requireAuditLog: true,
  blockedAutomaticActions: ["payments", "customer_outreach", "permission_changes", "production_deploys", "data_deletion"],
};
