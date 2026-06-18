import type {
  AgentTaskType,
  ModelCapability,
  ModelProviderTier,
  PriorityLevel,
  SensitivityLevel
} from "./model-provider-types.ts";

export type ModelRoutingRule = Readonly<{
  taskType: AgentTaskType;
  requiredCapability: ModelCapability;
  preferredProvider: ModelProviderTier;
  fallbackProvider: ModelProviderTier;
  latencyPriority: PriorityLevel;
  accuracyPriority: PriorityLevel;
  allowExternalModel: boolean;
  requiresAdminReview: boolean;
  auditRequired: boolean;
  sensitivityFloor: SensitivityLevel;
}>;

export const modelRoutingRules: readonly ModelRoutingRule[] = Object.freeze([
  rule("simple_summary", "summarization", "economy_external", "local_placeholder", "high", "low", true, false, true, "low"),
  rule("customer_support", "support_reasoning", "standard_external", "economy_external", "medium", "medium", true, false, true, "standard"),
  rule("business_strategy", "strategy_reasoning", "standard_external", "premium_external", "medium", "high", true, false, true, "standard"),
  rule("code_generation", "code_reasoning", "premium_external", "standard_external", "medium", "high", true, true, true, "restricted"),
  rule("content_generation", "creative_generation", "economy_external", "standard_external", "high", "medium", true, false, true, "standard"),
  rule("image_prompt_generation", "creative_generation", "economy_external", "standard_external", "high", "medium", true, false, true, "standard"),
  rule("data_extraction", "structured_extraction", "standard_external", "premium_external", "medium", "high", true, false, true, "restricted"),
  rule("compliance_review", "compliance_reasoning", "premium_external", "standard_external", "low", "high", true, true, true, "high"),
  rule("admin_risk_review", "risk_review", "premium_external", "standard_external", "low", "high", true, true, true, "high"),
  rule("campaign_generation", "creative_generation", "standard_external", "economy_external", "medium", "medium", true, true, true, "restricted"),
  rule("restaurant_receptionist_script", "support_reasoning", "standard_external", "premium_external", "medium", "high", true, true, true, "restricted"),
  rule("knowledge_search", "retrieval", "local_placeholder", "standard_external", "high", "medium", false, false, true, "standard"),
  rule("agent_planning", "planning", "standard_external", "premium_external", "medium", "high", true, true, true, "restricted")
]);

const fallbackModelRoutingRule = rule(
  "simple_summary",
  "summarization",
  "economy_external",
  "local_placeholder",
  "high",
  "low",
  true,
  false,
  true,
  "low"
);

export function getModelRoutingRule(taskType: AgentTaskType): ModelRoutingRule {
  return modelRoutingRules.find((item) => item.taskType === taskType) ?? fallbackModelRoutingRule;
}

function rule(
  taskType: AgentTaskType,
  requiredCapability: ModelCapability,
  preferredProvider: ModelProviderTier,
  fallbackProvider: ModelProviderTier,
  latencyPriority: PriorityLevel,
  accuracyPriority: PriorityLevel,
  allowExternalModel: boolean,
  requiresAdminReview: boolean,
  auditRequired: boolean,
  sensitivityFloor: SensitivityLevel
): ModelRoutingRule {
  return Object.freeze({
    taskType,
    requiredCapability,
    preferredProvider,
    fallbackProvider,
    latencyPriority,
    accuracyPriority,
    allowExternalModel,
    requiresAdminReview,
    auditRequired,
    sensitivityFloor
  });
}
