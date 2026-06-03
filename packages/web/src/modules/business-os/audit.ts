import type { AuditEventRef } from "./contracts.ts";
export function createBusinessAuditEvent(organization_id: string, action: string): AuditEventRef {
  return { organization_id, action, event_id: "audit_" + organization_id + "_" + action };
}
