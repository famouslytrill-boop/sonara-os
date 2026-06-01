import { createAutomationAuditEvent } from "./automation-audit-ledger.ts";
import { createWorkflowRecord, updateWorkflowStatus } from "./feature-spec.ts";
import type {
  ActionQueueState,
  AutomationAuditEvent,
  QueueActionResult,
  WorkflowRecord,
  WorkflowRecordInput
} from "./types.ts";

export function createActionQueue(initialState: Partial<ActionQueueState> = Object.freeze({})) {
  let state: ActionQueueState = Object.freeze({
    queued: Object.freeze([...(initialState.queued ?? [])]),
    approvalRequired: Object.freeze([...(initialState.approvalRequired ?? [])]),
    blocked: Object.freeze([...(initialState.blocked ?? [])]),
    completed: Object.freeze([...(initialState.completed ?? [])]),
    auditEvents: Object.freeze([...(initialState.auditEvents ?? [])])
  });

  function queueAction(input: WorkflowRecordInput): QueueActionResult {
    const record = createWorkflowRecord(input);
    const auditEvent = createAutomationAuditEvent(
      record,
      record.status === "blocked"
        ? "action.blocked"
        : record.status === "pending_approval"
          ? "approval.requested"
          : "action.queued",
      record.policy_reason
    );
    state = appendRecord(state, record, auditEvent);
    return Object.freeze({
      record,
      auditEvent,
      canRun: record.approval_level === "auto_safe"
    });
  }

  function completeAction(recordId: string): WorkflowRecord | null {
    const record = state.queued.find((item) => item.id === recordId);
    if (!record || record.approval_level !== "auto_safe") {
      return null;
    }
    const completed = updateWorkflowStatus(record, "completed");
    const auditEvent = createAutomationAuditEvent(
      completed,
      "action.completed",
      "Auto-safe routine action completed."
    );
    state = Object.freeze({
      ...state,
      queued: Object.freeze(state.queued.filter((item) => item.id !== recordId)),
      completed: Object.freeze([...state.completed, completed]),
      auditEvents: Object.freeze([...state.auditEvents, auditEvent])
    });
    return completed;
  }

  function recordApproval(record: WorkflowRecord, auditEvent: AutomationAuditEvent) {
    state = Object.freeze({
      ...state,
      approvalRequired: Object.freeze(
        state.approvalRequired.map((item) => (item.id === record.id ? record : item))
      ),
      auditEvents: Object.freeze([...state.auditEvents, auditEvent])
    });
  }

  function getState() {
    return state;
  }

  return Object.freeze({ queueAction, completeAction, recordApproval, getState });
}

function appendRecord(
  state: ActionQueueState,
  record: WorkflowRecord,
  auditEvent: AutomationAuditEvent
): ActionQueueState {
  if (record.status === "blocked") {
    return Object.freeze({
      ...state,
      blocked: Object.freeze([...state.blocked, record]),
      auditEvents: Object.freeze([...state.auditEvents, auditEvent])
    });
  }
  if (record.status === "pending_approval") {
    return Object.freeze({
      ...state,
      approvalRequired: Object.freeze([...state.approvalRequired, record]),
      auditEvents: Object.freeze([...state.auditEvents, auditEvent])
    });
  }
  return Object.freeze({
    ...state,
    queued: Object.freeze([...state.queued, record]),
    auditEvents: Object.freeze([...state.auditEvents, auditEvent])
  });
}
