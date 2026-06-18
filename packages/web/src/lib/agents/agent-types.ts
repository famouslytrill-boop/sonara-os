export type AgentTaskStatus = "draft" | "queued" | "requires_approval" | "blocked" | "completed";
export type AgentRiskLevel = "low" | "medium" | "high" | "critical";

export type AgentTask = Readonly<{
  id: string;
  owner_user_id: string;
  company_account_id: string;
  title: string;
  goal: string;
  status: AgentTaskStatus;
  risk_level: AgentRiskLevel;
  tool_ids: readonly string[];
  audit_required: boolean;
  created_at: string;
  updated_at: string;
}>;

export type AgentSession = Readonly<{
  id: string;
  owner_user_id: string;
  company_account_id: string;
  task_ids: readonly string[];
  persistence_status: "local_draft" | "server_ready";
  created_at: string;
  updated_at: string;
}>;

export type AgentControlPlaneModule = Readonly<{
  id: string;
  label: string;
  status: "foundation_ready" | "disabled_by_default" | "requires_provider_setup";
  safetyBoundary: string;
}>;

export const agentControlPlaneModules: readonly AgentControlPlaneModule[] = Object.freeze([
  module("user_goal", "User request / goal", "foundation_ready", "Every goal is scoped to a user and company account."),
  module("tool_registry", "Tool registry", "foundation_ready", "Tools are allowlisted and risk-labeled before use."),
  module("execution_layer", "Execution layer", "disabled_by_default", "No arbitrary shell or browser automation is enabled by default."),
  module("task_orchestration", "Task orchestration", "foundation_ready", "Tasks can be planned and queued but high-risk actions require approval."),
  module("memory_context", "Memory/context", "foundation_ready", "Context is scoped and redacted before model routing."),
  module("feedback_loop", "Feedback loop", "foundation_ready", "Feedback records are private account data."),
  module("scheduled_automation", "Scheduled automation", "disabled_by_default", "No hidden scheduled tasks are allowed."),
  module("session_persistence", "Session persistence", "requires_provider_setup", "Durable sessions require Supabase RLS verification."),
  module("agent_orchestrator", "Agent orchestrator", "foundation_ready", "Orchestration returns plans, not autonomous production changes."),
  module("api_integrations", "API integrations", "requires_provider_setup", "External API actions require permission and audit records."),
  module("file_operations", "File operations", "disabled_by_default", "Private file access requires explicit user consent."),
  module("long_running_tasks", "Long-running tasks", "requires_provider_setup", "Queues and recovery need provider setup."),
  module("model_routing", "Model routing", "foundation_ready", "Routing chooses a tier without calling providers."),
  module("audit_logs", "Audit logs", "foundation_ready", "Sensitive agent actions require audit entries.")
]);

function module(
  id: string,
  label: string,
  status: AgentControlPlaneModule["status"],
  safetyBoundary: string
): AgentControlPlaneModule {
  return Object.freeze({ id, label, status, safetyBoundary });
}
