export type AgentTraceRecord = {
  traceId: string;
  actorId: string;
  organizationId?: string;
  tool: string;
  action: string;
  riskLevel: "low" | "medium" | "high" | "blocked";
  approvalState: "not_required" | "pending" | "approved" | "denied";
  result: "planned" | "completed" | "blocked" | "failed";
  createdAt: string;
};
