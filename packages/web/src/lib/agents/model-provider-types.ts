export type AgentTaskType =
  | "simple_summary"
  | "customer_support"
  | "business_strategy"
  | "code_generation"
  | "content_generation"
  | "image_prompt_generation"
  | "data_extraction"
  | "compliance_review"
  | "admin_risk_review"
  | "campaign_generation"
  | "restaurant_receptionist_script"
  | "knowledge_search"
  | "agent_planning";

export type ModelCapability =
  | "summarization"
  | "support_reasoning"
  | "strategy_reasoning"
  | "code_reasoning"
  | "creative_generation"
  | "structured_extraction"
  | "compliance_reasoning"
  | "risk_review"
  | "retrieval"
  | "planning";

export type SensitivityLevel = "low" | "standard" | "restricted" | "high";
export type ModelCostTier = "free_or_local" | "low" | "standard" | "premium";
export type ModelProviderTier = "local_placeholder" | "economy_external" | "standard_external" | "premium_external";
export type PriorityLevel = "low" | "medium" | "high";

export type ModelRoutingRequest = Readonly<{
  taskType: AgentTaskType;
  requiredCapability: ModelCapability;
  sensitivityLevel: SensitivityLevel;
  maxCostTier: ModelCostTier;
  preferredProvider?: ModelProviderTier;
  allowExternalModel: boolean;
  latencyPriority: PriorityLevel;
  accuracyPriority: PriorityLevel;
  actorRole: "owner" | "admin" | "member" | "system";
}>;

export type ModelRoutingDecision = Readonly<{
  taskType: AgentTaskType;
  providerTier: ModelProviderTier;
  costTier: ModelCostTier;
  fallbackProvider: ModelProviderTier;
  requiresAdminReview: boolean;
  auditRequired: boolean;
  externalModelAllowed: boolean;
  reason: string;
}>;
