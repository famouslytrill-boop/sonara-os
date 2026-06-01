export type AuditEventType =
  | "feature_flag_checked"
  | "unsafe_flag_blocked"
  | "launch_gate_reviewed"
  | "human_review_required"
  | "placeholder_declared";

export interface AuditEvent {
  type: AuditEventType;
  summary: string;
  createdAt: string;
}

export function createAuditEvent(type: AuditEventType, summary: string): AuditEvent {
  return {
    type,
    summary,
    createdAt: new Date().toISOString()
  };
}
