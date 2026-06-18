import type { AgentRiskLevel } from "./agent-types.ts";

export type AgentToolRecord = Readonly<{
  id: string;
  label: string;
  category: "internal_planning" | "support" | "campaign" | "file" | "external_api";
  risk_level: AgentRiskLevel;
  enabled_by_default: boolean;
  approval_required: boolean;
  blocked_actions: readonly string[];
}>;

export const agentToolRegistry: readonly AgentToolRecord[] = Object.freeze([
  tool("task_planner", "Task Planner", "internal_planning", "low", true, false, []),
  tool("knowledge_search", "Knowledge Search", "support", "medium", true, false, []),
  tool("campaign_draft", "Campaign Draft Builder", "campaign", "high", true, true, [
    "automatic_send",
    "fake_reviews",
    "spam_outreach"
  ]),
  tool("file_reader", "File Reader", "file", "high", false, true, [
    "private_file_access_without_consent",
    "secret_export"
  ]),
  tool("external_api_action", "External API Action", "external_api", "critical", false, true, [
    "payments",
    "permission_changes",
    "production_deploys",
    "customer_contact_without_approval"
  ])
]);

export function getEnabledAgentTools(): readonly AgentToolRecord[] {
  return agentToolRegistry.filter((toolRecord) => toolRecord.enabled_by_default);
}

function tool(
  id: string,
  label: string,
  category: AgentToolRecord["category"],
  risk_level: AgentRiskLevel,
  enabled_by_default: boolean,
  approval_required: boolean,
  blocked_actions: readonly string[]
): AgentToolRecord {
  return Object.freeze({
    id,
    label,
    category,
    risk_level,
    enabled_by_default,
    approval_required,
    blocked_actions: Object.freeze([...blocked_actions])
  });
}
