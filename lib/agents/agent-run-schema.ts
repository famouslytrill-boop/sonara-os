export type AgentRun = {
  id: string;
  organizationId: string;
  actorUserId: string;
  agentKey: string;
  objective: string;
  status: "planned" | "awaiting_approval" | "running" | "completed" | "blocked" | "failed";
  approvalState: "not_required" | "pending" | "approved" | "denied";
  createdAt: string;
};
