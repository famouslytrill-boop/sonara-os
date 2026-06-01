export type AgentActionCategory =
  | "draft"
  | "research"
  | "production_deploy"
  | "stripe_change"
  | "payout_change"
  | "legal_change"
  | "security_change"
  | "customer_campaign"
  | "data_deletion"
  | "unknown";

export type AgentActionDecision = Readonly<{
  category: AgentActionCategory;
  allowed: boolean;
  approvalRequired: boolean;
  blocked: boolean;
  reason: string;
}>;

export const agentOrchestrationFeatureFlags = Object.freeze({
  AGENTS_DRAFT_ONLY_BY_DEFAULT: true,
  PRODUCTION_DEPLOY_BY_AGENT_REQUIRES_OWNER_APPROVAL: true,
  AUTO_INSTALL_UNKNOWN_TOOLS: false,
  AUTO_EDIT_STRIPE_SETTINGS: false,
  AUTO_DELETE_DATA: false,
  AUTO_SEND_CUSTOMER_CAMPAIGNS: false
});

export function evaluateAgentAction(category: AgentActionCategory): AgentActionDecision {
  if (["draft", "research"].includes(category)) {
    return decision(category, true, false, false, "Draft and research actions are allowed.");
  }
  if (
    [
      "production_deploy",
      "stripe_change",
      "legal_change",
      "security_change",
      "customer_campaign",
      "data_deletion"
    ].includes(category)
  ) {
    return decision(category, false, true, false, "Owner approval is required before execution.");
  }
  if (category === "payout_change") {
    return decision(category, false, true, true, "Automation cannot change payout destination.");
  }
  return decision("unknown", false, true, false, "Unknown agent actions default to owner review.");
}

function decision(
  category: AgentActionCategory,
  allowed: boolean,
  approvalRequired: boolean,
  blocked: boolean,
  reason: string
): AgentActionDecision {
  return Object.freeze({ category, allowed, approvalRequired, blocked, reason });
}
