import type { AgentRiskLevel } from "./agent-types.ts";

export type AgentAuditLogEntry = Readonly<{
  id: string;
  actor_user_id: string;
  company_account_id: string;
  task_id: string;
  tool_id: string;
  action: string;
  risk_level: AgentRiskLevel;
  approval_state: "not_required" | "required" | "approved" | "blocked";
  result: "planned" | "queued" | "blocked" | "completed";
  created_at: string;
  secrets_exposed: false;
}>;

export function createAgentAuditLogEntry(
  input: Omit<AgentAuditLogEntry, "id" | "created_at" | "secrets_exposed">,
  now = new Date().toISOString()
): AgentAuditLogEntry {
  return Object.freeze({
    ...input,
    id: `agent_audit_${input.task_id}_${now}`,
    created_at: now,
    secrets_exposed: false
  });
}
