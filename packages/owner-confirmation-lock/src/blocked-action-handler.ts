import { createApprovalAuditEvent } from "./approval-audit-ledger.ts";
import type { ApprovalAuditEvent, BlockedActionReason, SensitiveActionRecord } from "./types.ts";

export function blockSensitiveAction(
  record: SensitiveActionRecord,
  reason: BlockedActionReason = record.blocked_reason ?? "always_blocked",
  actorId = record.created_by,
  createdAt = new Date().toISOString()
): { record: SensitiveActionRecord; auditEvent: ApprovalAuditEvent } {
  const blockedRecord: SensitiveActionRecord = Object.freeze({
    ...record,
    approval_status: "blocked",
    blocked_reason: reason,
    updated_at: createdAt
  });
  return Object.freeze({
    record: blockedRecord,
    auditEvent: createApprovalAuditEvent(
      blockedRecord,
      "owner_review.blocked",
      actorId,
      `Blocked action: ${reason}`,
      createdAt,
      { blocked_reason: reason }
    )
  });
}

export function canBlockedActionExecute(record: SensitiveActionRecord): boolean {
  return record.approval_requirement !== "blocked_always" && record.approval_status !== "blocked";
}
