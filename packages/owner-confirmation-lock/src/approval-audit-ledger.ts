import { createRecordId, sanitizeMetadata } from "./owner-confirmation-policy.ts";
import type { ApprovalAuditEvent, ApprovalAuditEventType, SensitiveActionRecord } from "./types.ts";

export function createApprovalAuditEvent(
  record: SensitiveActionRecord,
  eventType: ApprovalAuditEventType,
  actorId: string,
  summary: string,
  createdAt = new Date().toISOString(),
  metadata: Readonly<Record<string, unknown>> = Object.freeze({})
): ApprovalAuditEvent {
  return Object.freeze({
    id: createRecordId("owner_approval_event"),
    action_id: record.id,
    organization_id: record.organization_id,
    actor_id: actorId,
    event_type: eventType,
    action_category: record.action_category,
    action_key: record.action_key,
    product_area: record.product_area,
    risk_level: record.risk_level,
    approval_status: record.approval_status,
    summary,
    created_at: createdAt,
    metadata: sanitizeMetadata(metadata)
  });
}

export function createApprovalAuditLedger(
  initialEvents: readonly ApprovalAuditEvent[] = Object.freeze([])
) {
  let events = Object.freeze([...initialEvents]);

  function append(event: ApprovalAuditEvent) {
    events = Object.freeze([...events, event]);
    return event;
  }

  function getEvents() {
    return events;
  }

  return Object.freeze({ append, getEvents });
}
