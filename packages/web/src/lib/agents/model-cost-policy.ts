import type { AgentTaskType, ModelCostTier, SensitivityLevel } from "./model-provider-types.ts";

export type ModelCostPolicy = Readonly<{
  taskType: AgentTaskType;
  defaultCostTier: ModelCostTier;
  highSensitivityCostTier: ModelCostTier;
  adminReviewCostTier: ModelCostTier;
}>;

const costOrder: readonly ModelCostTier[] = Object.freeze([
  "free_or_local",
  "low",
  "standard",
  "premium"
]);

export const modelCostPolicies: readonly ModelCostPolicy[] = Object.freeze([
  policy("simple_summary", "low", "standard", "premium"),
  policy("customer_support", "standard", "standard", "premium"),
  policy("business_strategy", "standard", "premium", "premium"),
  policy("code_generation", "standard", "premium", "premium"),
  policy("content_generation", "low", "standard", "premium"),
  policy("image_prompt_generation", "low", "standard", "premium"),
  policy("data_extraction", "standard", "premium", "premium"),
  policy("compliance_review", "premium", "premium", "premium"),
  policy("admin_risk_review", "premium", "premium", "premium"),
  policy("campaign_generation", "standard", "premium", "premium"),
  policy("restaurant_receptionist_script", "standard", "premium", "premium"),
  policy("knowledge_search", "low", "standard", "premium"),
  policy("agent_planning", "standard", "premium", "premium")
]);

const fallbackModelCostPolicy = policy("simple_summary", "low", "standard", "premium");

export function chooseAllowedCostTier({
  taskType,
  sensitivityLevel,
  maxCostTier
}: {
  taskType: AgentTaskType;
  sensitivityLevel: SensitivityLevel;
  maxCostTier: ModelCostTier;
}): ModelCostTier {
  const policyForTask =
    modelCostPolicies.find((item) => item.taskType === taskType) ?? fallbackModelCostPolicy;
  const requested =
    sensitivityLevel === "high" || sensitivityLevel === "restricted"
      ? policyForTask.highSensitivityCostTier
      : policyForTask.defaultCostTier;
  return minCostTier(requested, maxCostTier);
}

export function isHighCostTier(tier: ModelCostTier): boolean {
  return tier === "premium";
}

function minCostTier(requested: ModelCostTier, maximum: ModelCostTier): ModelCostTier {
  return costOrder.indexOf(requested) <= costOrder.indexOf(maximum) ? requested : maximum;
}

function policy(
  taskType: AgentTaskType,
  defaultCostTier: ModelCostTier,
  highSensitivityCostTier: ModelCostTier,
  adminReviewCostTier: ModelCostTier
): ModelCostPolicy {
  return Object.freeze({ taskType, defaultCostTier, highSensitivityCostTier, adminReviewCostTier });
}
