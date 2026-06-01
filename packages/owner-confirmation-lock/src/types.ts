export type OwnerConfirmationCategory =
  | "money_movement"
  | "refunds"
  | "price_changes"
  | "payout_settings"
  | "legal_policy_text"
  | "customer_facing_campaigns"
  | "security_setting_changes"
  | "deleting_data"
  | "publishing_proof_reviews"
  | "ai_voice_output"
  | "ai_visual_output"
  | "ai_video_output";

export type ActionRiskLevel = "low" | "medium" | "high" | "critical";

export type OwnerConfirmationStatus =
  | "draft"
  | "queued_for_owner_review"
  | "approved"
  | "rejected"
  | "expired"
  | "blocked"
  | "executed_after_approval";

export type OwnerApprovalRequirement =
  | "no_approval_needed"
  | "owner_review_required"
  | "admin_review_required"
  | "blocked_always";

export type BlockedActionReason =
  | "always_blocked"
  | "missing_owner_confirmation"
  | "rejected_by_owner"
  | "expired_confirmation"
  | "unknown_action_requires_review"
  | "audit_log_deletion_blocked"
  | "payout_destination_change_blocked"
  | "security_gate_disable_blocked"
  | "fake_proof_or_review_blocked"
  | "deceptive_claim_blocked";

export type OwnerConfirmationAction = Readonly<{
  id?: string;
  actionKey: string;
  category?: OwnerConfirmationCategory | string;
  productArea: string;
  title: string;
  description: string;
  triggeredBy: string;
  organizationId?: string;
  createdBy?: string;
  affectedRecords?: readonly string[];
  publicPrivateImpact?: string;
  moneySecurityLegalCustomerImpact?: string;
  beforePreview?: string;
  afterPreview?: string;
  generatedContentPreview?: string;
  metadata?: Readonly<Record<string, unknown>>;
  requestedAt?: string;
  expiresAt?: string;
}>;

export type SensitiveActionRecord = Readonly<{
  id: string;
  organization_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  action_category: OwnerConfirmationCategory | "unknown";
  action_key: string;
  product_area: string;
  risk_level: ActionRiskLevel;
  approval_requirement: OwnerApprovalRequirement;
  approval_status: OwnerConfirmationStatus;
  title: string;
  description: string;
  triggered_by: string;
  affected_records: readonly string[];
  public_private_impact: string;
  money_security_legal_customer_impact: string;
  before_preview?: string;
  after_preview?: string;
  generated_content_preview?: string;
  approved_by?: string;
  approved_at?: string;
  rejected_by?: string;
  rejected_at?: string;
  blocked_reason?: BlockedActionReason;
  expires_at?: string;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type OwnerReviewQueueItem = Readonly<{
  id: string;
  action_id: string;
  organization_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  action_category: OwnerConfirmationCategory | "unknown";
  action_key: string;
  product_area: string;
  risk_level: ActionRiskLevel;
  approval_status: OwnerConfirmationStatus;
  title: string;
  action_preview: string;
  affected_records: readonly string[];
  expires_at?: string;
}>;

export type ApprovalAuditEventType =
  | "owner_review.queued"
  | "owner_review.approved"
  | "owner_review.rejected"
  | "owner_review.blocked"
  | "owner_review.executed_after_approval"
  | "owner_review.expired";

export type ApprovalAuditEvent = Readonly<{
  id: string;
  action_id: string;
  organization_id: string;
  actor_id: string;
  event_type: ApprovalAuditEventType;
  action_category: OwnerConfirmationCategory | "unknown";
  action_key: string;
  product_area: string;
  risk_level: ActionRiskLevel;
  approval_status: OwnerConfirmationStatus;
  summary: string;
  created_at: string;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type ConfirmationToken = Readonly<{
  id: string;
  action_id: string;
  organization_id: string;
  owner_id: string;
  token_hash: string;
  status: "active" | "used" | "expired" | "revoked";
  created_at: string;
  expires_at: string;
  used_at?: string;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type SensitiveActionRegistryEntry = Readonly<{
  category: OwnerConfirmationCategory;
  title: string;
  riskLevel: ActionRiskLevel;
  approvalRequirement: OwnerApprovalRequirement;
  summary: string;
  rules: readonly string[];
  integrations: readonly string[];
}>;

export type OwnerConfirmationDecision = Readonly<{
  record: SensitiveActionRecord;
  auditEvent: ApprovalAuditEvent;
  approved: boolean;
}>;

export type OwnerConfirmationExecutionResult = Readonly<{
  record: SensitiveActionRecord | null;
  auditEvent: ApprovalAuditEvent | null;
  executed: boolean;
  reason: string;
}>;

export type HumanApprovalGateState = Readonly<{
  records: readonly SensitiveActionRecord[];
  queue: readonly OwnerReviewQueueItem[];
  auditEvents: readonly ApprovalAuditEvent[];
}>;
