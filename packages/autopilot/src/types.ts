export type AutopilotWorkflowType =
  | "follow_up_customer"
  | "request_review"
  | "send_booking_reminder"
  | "create_offer_draft"
  | "flag_unpaid_invoice"
  | "flag_incomplete_profile"
  | "suggest_campaign"
  | "suggest_win_back"
  | "create_task"
  | "draft_message"
  | "sync_external_connection";

export type ApprovalLevel = "auto_safe" | "owner_review" | "admin_review" | "blocked";

export type AutomationRiskLabel = "low" | "medium" | "high" | "critical";

export type AutomationActionKind =
  | "create_internal_task"
  | "draft_message"
  | "update_setup_checklist"
  | "flag_missing_info"
  | "generate_non_public_recommendation"
  | "queue_reminder_draft"
  | "send_customer_message"
  | "publish_offer"
  | "change_pricing"
  | "update_payment_link"
  | "send_review_request"
  | "send_campaign"
  | "approve_generated_media"
  | "update_legal_policy_copy"
  | "legal_notice"
  | "refund_without_approval"
  | "delete_customer_data"
  | "change_owner_role"
  | "send_high_stakes_advice"
  | "disable_security_feature"
  | "change_payout_destination"
  | "publish_fake_proof_or_review"
  | "bypass_compliance_warning"
  | "sync_external_connection";

export type WorkflowStatus = "queued" | "pending_approval" | "approved" | "completed" | "blocked";

export type AutomationPolicyRule = Readonly<{
  actionKind: AutomationActionKind;
  approvalLevel: ApprovalLevel;
  risk: AutomationRiskLabel;
  label: string;
  reason: string;
}>;

export type WorkflowRecordInput = Readonly<{
  workflowType: AutopilotWorkflowType;
  actionKind: AutomationActionKind;
  title: string;
  description: string;
  organizationId?: string;
  actorId?: string;
  confidence?: number;
}>;

export type WorkflowRecord = Readonly<{
  id: string;
  organization_id: string;
  created_by: string;
  workflow_type: AutopilotWorkflowType;
  action_kind: AutomationActionKind;
  title: string;
  description: string;
  approval_level: ApprovalLevel;
  risk: AutomationRiskLabel;
  confidence: number;
  status: WorkflowStatus;
  policy_reason: string;
  created_at: string;
  updated_at: string;
}>;

export type AutomationAuditEventType =
  | "workflow.created"
  | "action.queued"
  | "action.blocked"
  | "approval.requested"
  | "approval.granted"
  | "approval.rejected"
  | "action.completed";

export type AutomationAuditEvent = Readonly<{
  id: string;
  workflow_id: string;
  organization_id: string;
  actor_id: string;
  event_type: AutomationAuditEventType;
  approval_level: ApprovalLevel;
  risk: AutomationRiskLabel;
  summary: string;
  created_at: string;
}>;

export type ActionQueueState = Readonly<{
  queued: readonly WorkflowRecord[];
  approvalRequired: readonly WorkflowRecord[];
  blocked: readonly WorkflowRecord[];
  completed: readonly WorkflowRecord[];
  auditEvents: readonly AutomationAuditEvent[];
}>;

export type QueueActionResult = Readonly<{
  record: WorkflowRecord;
  auditEvent: AutomationAuditEvent;
  canRun: boolean;
}>;

export type ApprovalDecision = Readonly<{
  record: WorkflowRecord;
  auditEvent: AutomationAuditEvent;
  approved: boolean;
}>;
