import { createAutomationAuditEvent } from "./automation-audit-ledger.ts";
import { updateWorkflowStatus } from "./feature-spec.ts";
import type { ApprovalDecision, WorkflowRecord } from "./types.ts";

export function approveWorkflowRecord(
  record: WorkflowRecord,
  reviewerId: string,
  createdAt = new Date().toISOString()
): ApprovalDecision {
  if (record.approval_level === "blocked") {
    return rejectWorkflowRecord(
      record,
      reviewerId,
      "Blocked actions cannot be approved.",
      createdAt
    );
  }
  if (record.approval_level === "auto_safe") {
    const approvedRecord = updateWorkflowStatus(record, "approved", createdAt);
    return Object.freeze({
      record: approvedRecord,
      auditEvent: createAutomationAuditEvent(
        approvedRecord,
        "approval.granted",
        "Auto-safe action confirmed.",
        reviewerId,
        createdAt
      ),
      approved: true
    });
  }

  const approvedRecord = updateWorkflowStatus(record, "approved", createdAt);
  return Object.freeze({
    record: approvedRecord,
    auditEvent: createAutomationAuditEvent(
      approvedRecord,
      "approval.granted",
      "Human review approved the queued action.",
      reviewerId,
      createdAt
    ),
    approved: true
  });
}

export function rejectWorkflowRecord(
  record: WorkflowRecord,
  reviewerId: string,
  reason = "Human review rejected the queued action.",
  createdAt = new Date().toISOString()
): ApprovalDecision {
  const rejectedRecord = updateWorkflowStatus(record, "blocked", createdAt);
  return Object.freeze({
    record: rejectedRecord,
    auditEvent: createAutomationAuditEvent(
      rejectedRecord,
      "approval.rejected",
      reason,
      reviewerId,
      createdAt
    ),
    approved: false
  });
}
