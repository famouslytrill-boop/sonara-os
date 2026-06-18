import type { AgentTask } from "./agent-types.ts";
import { routeModelTask, createDefaultRoutingRequest } from "./model-routing.ts";

export type AgentTaskDraftInput = Readonly<{
  owner_user_id: string;
  company_account_id: string;
  title: string;
  goal: string;
  taskType: Parameters<typeof createDefaultRoutingRequest>[0];
}>;

export function createAgentTaskDraft(
  input: AgentTaskDraftInput,
  now = new Date().toISOString()
): AgentTask {
  const routing = routeModelTask(createDefaultRoutingRequest(input.taskType));
  return Object.freeze({
    id: `agent_task_${input.taskType}_${Date.now()}`,
    owner_user_id: input.owner_user_id,
    company_account_id: input.company_account_id,
    title: input.title.trim(),
    goal: input.goal.trim(),
    status: routing.requiresAdminReview ? "requires_approval" : "queued",
    risk_level: routing.requiresAdminReview ? "high" : "medium",
    tool_ids: Object.freeze(["task_planner", "knowledge_search"]),
    audit_required: true,
    created_at: now,
    updated_at: now
  });
}

export function canAgentTaskExecute(task: AgentTask): boolean {
  return task.status === "queued" && task.risk_level !== "critical";
}
