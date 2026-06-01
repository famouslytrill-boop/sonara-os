import type { WorkflowRecord, WorkflowRecordInput, WorkflowStatus } from "./types.ts";
import { evaluateAutomationAction } from "./safe-automation-policy.ts";

const defaultOrganizationId = "local_business_setup";
const defaultActorId = "autopilot_setup";

export function createWorkflowRecord(
  input: WorkflowRecordInput,
  createdAt = new Date().toISOString(),
  id = createRecordId("workflow")
): WorkflowRecord {
  const policy = evaluateAutomationAction(input.actionKind);
  const status: WorkflowStatus =
    policy.approvalLevel === "blocked"
      ? "blocked"
      : policy.approvalLevel === "auto_safe"
        ? "queued"
        : "pending_approval";

  return Object.freeze({
    id,
    organization_id: input.organizationId?.trim() || defaultOrganizationId,
    created_by: input.actorId?.trim() || defaultActorId,
    workflow_type: input.workflowType,
    action_kind: input.actionKind,
    title: input.title.trim(),
    description: input.description.trim(),
    approval_level: policy.approvalLevel,
    risk: policy.risk,
    confidence: normalizeConfidence(input.confidence),
    status,
    policy_reason: policy.reason,
    created_at: createdAt,
    updated_at: createdAt
  });
}

export function updateWorkflowStatus(
  record: WorkflowRecord,
  status: WorkflowStatus,
  updatedAt = new Date().toISOString()
): WorkflowRecord {
  return Object.freeze({
    ...record,
    status,
    updated_at: updatedAt
  });
}

function normalizeConfidence(confidence: number | undefined): number {
  if (typeof confidence !== "number" || Number.isNaN(confidence)) {
    return 0.6;
  }
  return Math.min(1, Math.max(0, confidence));
}

function createRecordId(prefix: string): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${prefix}_${random}`;
}
