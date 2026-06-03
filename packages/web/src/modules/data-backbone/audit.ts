import type { AuditEvent } from "./contracts.ts";
export function createAuditEvent(input: AuditEvent): AuditEvent {
  return input;
}
export function sensitiveActionHasAudit(event?: AuditEvent): boolean {
  return Boolean(event?.organization_id && event.actor_id && event.action);
}
