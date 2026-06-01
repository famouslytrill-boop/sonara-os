export type PermissionAuditEvent = {
  permission: string;
  action: "planned" | "requested" | "revoked" | "blocked";
  createdAt: string;
  notes: string;
};

export function buildPermissionAuditEvent(event: Omit<PermissionAuditEvent, "createdAt">): PermissionAuditEvent {
  return { ...event, createdAt: new Date().toISOString() };
}
