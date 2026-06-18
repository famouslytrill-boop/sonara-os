import { modelContract, type BaseModel } from "./base-model.ts";

export type AgentTaskModel = BaseModel & Readonly<{
  title: string;
  task_type: string;
  status: "draft" | "queued" | "requires_approval" | "blocked" | "completed";
  risk_level: "low" | "medium" | "high" | "critical";
}>;

export const agentTaskModel = modelContract("agent_tasks", [
  "owner_user_id and company_account_id are required",
  "high-risk tasks require approval before execution",
  "agent tasks cannot run arbitrary code by default"
]);
