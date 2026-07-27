export type AuditLogSeverity = "info" | "warning" | "critical";

export type AuditLogEvent = {
  eventType: string;
  severity: AuditLogSeverity;
  summary: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};
