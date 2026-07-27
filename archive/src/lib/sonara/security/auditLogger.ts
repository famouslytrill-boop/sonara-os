import type { AuditLogEvent, AuditLogSeverity } from "./auditLogTypes";

function redactMetadata(metadata?: Record<string, unknown>) {
  if (!metadata) return undefined;

  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => {
      if (/secret|key|token|password/i.test(key)) {
        return [key, "[redacted]"];
      }

      return [key, value];
    })
  );
}

export function createAuditLogEvent({
  eventType,
  severity = "info",
  summary,
  metadata,
}: {
  eventType: string;
  severity?: AuditLogSeverity;
  summary: string;
  metadata?: Record<string, unknown>;
}): AuditLogEvent {
  return {
    eventType,
    severity,
    summary,
    metadata: redactMetadata(metadata),
    createdAt: new Date().toISOString(),
  };
}

export function logAuditEvent(event: AuditLogEvent) {
  console.info("SONARA audit event", event);
}
