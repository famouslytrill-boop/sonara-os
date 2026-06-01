import { createApprovalAuditEvent } from "./approval-audit-ledger.ts";
import { createSensitiveActionRecord } from "./owner-confirmation-policy.ts";
import { createOwnerReviewQueueItem as buildOwnerReviewQueueItem } from "./owner-review-queue.ts";
import { blockSensitiveAction } from "./blocked-action-handler.ts";
import type {
  BlockedActionReason,
  HumanApprovalGateState,
  OwnerConfirmationAction,
  OwnerConfirmationDecision,
  OwnerConfirmationExecutionResult,
  SensitiveActionRecord
} from "./types.ts";

export function createHumanApprovalGate(
  initialState: Partial<HumanApprovalGateState> = Object.freeze({})
) {
  let state: HumanApprovalGateState = Object.freeze({
    records: Object.freeze([...(initialState.records ?? [])]),
    queue: Object.freeze([...(initialState.queue ?? [])]),
    auditEvents: Object.freeze([...(initialState.auditEvents ?? [])])
  });

  function submitAction(action: OwnerConfirmationAction): {
    record: SensitiveActionRecord;
    queued: boolean;
  } {
    const record = createSensitiveActionRecord(action, "queued_for_owner_review");
    if (record.approval_requirement === "blocked_always" || record.approval_status === "blocked") {
      const blocked = blockSensitiveAction(record, record.blocked_reason ?? "always_blocked");
      state = Object.freeze({
        ...state,
        records: Object.freeze([...state.records, blocked.record]),
        auditEvents: Object.freeze([...state.auditEvents, blocked.auditEvent])
      });
      return Object.freeze({ record: blocked.record, queued: false });
    }

    const queueItem = buildOwnerReviewQueueItem(record);
    const auditEvent = createApprovalAuditEvent(
      record,
      "owner_review.queued",
      record.created_by,
      "Sensitive action queued for owner review."
    );
    state = Object.freeze({
      ...state,
      records: Object.freeze([...state.records, record]),
      queue: Object.freeze([...state.queue, queueItem]),
      auditEvents: Object.freeze([...state.auditEvents, auditEvent])
    });
    return Object.freeze({ record, queued: true });
  }

  function approveAction(actionId: string, ownerId: string): OwnerConfirmationDecision {
    const record = findRecord(actionId);
    if (!record || record.approval_status === "blocked" || record.approval_status === "rejected") {
      const blockedRecord = record ?? createMissingRecord(actionId, ownerId);
      const blocked = blockSensitiveAction(blockedRecord, "missing_owner_confirmation", ownerId);
      updateRecord(blocked.record, blocked.auditEvent);
      return Object.freeze({
        record: blocked.record,
        auditEvent: blocked.auditEvent,
        approved: false
      });
    }
    const approvedRecord: SensitiveActionRecord = Object.freeze({
      ...record,
      approval_status: "approved",
      approved_by: ownerId,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    const auditEvent = createApprovalAuditEvent(
      approvedRecord,
      "owner_review.approved",
      ownerId,
      "Owner approved sensitive action."
    );
    updateRecord(approvedRecord, auditEvent);
    return Object.freeze({ record: approvedRecord, auditEvent, approved: true });
  }

  function rejectAction(
    actionId: string,
    ownerId: string,
    reason = "Owner rejected sensitive action."
  ): OwnerConfirmationDecision {
    const record = findRecord(actionId) ?? createMissingRecord(actionId, ownerId);
    const rejectedRecord: SensitiveActionRecord = Object.freeze({
      ...record,
      approval_status: "rejected",
      rejected_by: ownerId,
      rejected_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    const auditEvent = createApprovalAuditEvent(
      rejectedRecord,
      "owner_review.rejected",
      ownerId,
      reason,
      new Date().toISOString(),
      { reason }
    );
    updateRecord(rejectedRecord, auditEvent);
    return Object.freeze({ record: rejectedRecord, auditEvent, approved: false });
  }

  function blockAction(
    actionId: string,
    reason: BlockedActionReason = "always_blocked"
  ): OwnerConfirmationDecision {
    const record = findRecord(actionId) ?? createMissingRecord(actionId, "system");
    const blocked = blockSensitiveAction(record, reason, "system");
    updateRecord(blocked.record, blocked.auditEvent);
    return Object.freeze({
      record: blocked.record,
      auditEvent: blocked.auditEvent,
      approved: false
    });
  }

  function executeOnlyAfterApproval(actionId: string): OwnerConfirmationExecutionResult {
    const record = findRecord(actionId);
    if (!record || record.approval_status !== "approved") {
      return Object.freeze({
        record: record ?? null,
        auditEvent: null,
        executed: false,
        reason: "Action cannot execute without owner approval."
      });
    }
    const executedRecord: SensitiveActionRecord = Object.freeze({
      ...record,
      approval_status: "executed_after_approval",
      updated_at: new Date().toISOString()
    });
    const auditEvent = createApprovalAuditEvent(
      executedRecord,
      "owner_review.executed_after_approval",
      record.approved_by ?? record.created_by,
      "Sensitive action executed after owner approval."
    );
    updateRecord(executedRecord, auditEvent);
    return Object.freeze({
      record: executedRecord,
      auditEvent,
      executed: true,
      reason: "Executed after owner approval."
    });
  }

  function getState() {
    return state;
  }

  function findRecord(actionId: string): SensitiveActionRecord | undefined {
    return state.records.find((record) => record.id === actionId);
  }

  function updateRecord(
    record: SensitiveActionRecord,
    auditEvent: ReturnType<typeof createApprovalAuditEvent>
  ) {
    const nextRecords = state.records.some((item) => item.id === record.id)
      ? state.records.map((item) => (item.id === record.id ? record : item))
      : [...state.records, record];
    state = Object.freeze({
      ...state,
      records: Object.freeze(nextRecords),
      queue: Object.freeze(state.queue.filter((item) => item.action_id !== record.id)),
      auditEvents: Object.freeze([...state.auditEvents, auditEvent])
    });
  }

  return Object.freeze({
    submitAction,
    approveAction,
    rejectAction,
    blockAction,
    executeOnlyAfterApproval,
    getState
  });
}

function createMissingRecord(actionId: string, actorId: string): SensitiveActionRecord {
  return createSensitiveActionRecord(
    {
      id: actionId,
      actionKey: "missing_action",
      productArea: "Unknown",
      title: "Missing action",
      description: "Action was not found in owner review state.",
      triggeredBy: actorId,
      createdBy: actorId
    },
    "blocked"
  );
}

const defaultGate = createHumanApprovalGate();

export function createOwnerReviewQueueItem(action: OwnerConfirmationAction) {
  return defaultGate.submitAction(action);
}

export function approveAction(actionId: string, ownerId: string) {
  return defaultGate.approveAction(actionId, ownerId);
}

export function rejectAction(actionId: string, ownerId: string, reason?: string) {
  return defaultGate.rejectAction(actionId, ownerId, reason);
}

export function blockAction(actionId: string, reason?: BlockedActionReason) {
  return defaultGate.blockAction(actionId, reason);
}

export function executeOnlyAfterApproval(actionId: string) {
  return defaultGate.executeOnlyAfterApproval(actionId);
}
