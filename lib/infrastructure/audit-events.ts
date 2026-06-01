export type AuditEventRisk = "low" | "medium" | "high" | "blocked";

export type AuditEventInput = {
  actorId: string;
  organizationId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  risk: AuditEventRisk;
  approvalState?: "not_required" | "pending" | "approved" | "denied";
};

export function buildAuditEvent(input: AuditEventInput) {
  return {
    ...input,
    approvalState: input.approvalState ?? (input.risk === "high" || input.risk === "blocked" ? "pending" : "not_required"),
    createdAt: new Date().toISOString(),
  };
}
