import type { AutomationAuditEvent, AutomationAuditEventType, WorkflowRecord } from "./types.ts";

export function createAutomationAuditEvent(
  record: WorkflowRecord,
  eventType: AutomationAuditEventType,
  summary: string,
  actorId = record.created_by,
  createdAt = new Date().toISOString(),
  id = createRecordId("audit")
): AutomationAuditEvent {
  return Object.freeze({
    id,
    workflow_id: record.id,
    organization_id: record.organization_id,
    actor_id: actorId,
    event_type: eventType,
    approval_level: record.approval_level,
    risk: record.risk,
    summary: summary.trim(),
    created_at: createdAt
  });
}

export function createAutomationAuditLedger(
  initialEvents: readonly AutomationAuditEvent[] = Object.freeze([])
) {
  let events = Object.freeze([...initialEvents]);

  function append(event: AutomationAuditEvent) {
    events = Object.freeze([...events, event]);
    return event;
  }

  function getEvents() {
    return events;
  }

  return Object.freeze({ append, getEvents });
}

function createRecordId(prefix: string): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${prefix}_${random}`;
}
