export type WorkflowRun = {
  id: string;
  organizationId: string;
  workflowKey: string;
  status: "planned" | "queued" | "running" | "completed" | "blocked" | "failed";
  approvalState: "not_required" | "pending" | "approved" | "denied";
  correlationId: string;
  createdAt: string;
};
