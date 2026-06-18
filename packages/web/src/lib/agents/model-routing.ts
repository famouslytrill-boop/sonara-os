import { chooseAllowedCostTier, isHighCostTier } from "./model-cost-policy.ts";
import type {
  ModelProviderTier,
  ModelRoutingDecision,
  ModelRoutingRequest
} from "./model-provider-types.ts";
import { getModelRoutingRule } from "./model-routing-rules.ts";

const costTierToProvider: Record<string, ModelProviderTier> = {
  free_or_local: "local_placeholder",
  low: "economy_external",
  standard: "standard_external",
  premium: "premium_external"
};

export function routeModelTask(request: ModelRoutingRequest): ModelRoutingDecision {
  const rule = getModelRoutingRule(request.taskType);
  const costTier = chooseAllowedCostTier({
    taskType: request.taskType,
    sensitivityLevel: request.sensitivityLevel,
    maxCostTier: request.maxCostTier
  });
  const externalModelAllowed = request.allowExternalModel && rule.allowExternalModel;
  const providerTier = externalModelAllowed
    ? request.preferredProvider ?? costTierToProvider[costTier]
    : "local_placeholder";
  const requiresAdminReview =
    rule.requiresAdminReview ||
    request.sensitivityLevel === "high" ||
    request.sensitivityLevel === "restricted" ||
    isHighCostTier(costTier);

  return Object.freeze({
    taskType: request.taskType,
    providerTier,
    costTier,
    fallbackProvider: externalModelAllowed ? rule.fallbackProvider : "local_placeholder",
    requiresAdminReview,
    auditRequired: true,
    externalModelAllowed,
    reason: createRoutingReason(providerTier, costTier, requiresAdminReview)
  });
}

export function createDefaultRoutingRequest(
  taskType: ModelRoutingRequest["taskType"]
): ModelRoutingRequest {
  const rule = getModelRoutingRule(taskType);
  return Object.freeze({
    taskType,
    requiredCapability: rule.requiredCapability,
    sensitivityLevel: rule.sensitivityFloor,
    maxCostTier: "standard",
    preferredProvider: rule.preferredProvider,
    allowExternalModel: rule.allowExternalModel,
    latencyPriority: rule.latencyPriority,
    accuracyPriority: rule.accuracyPriority,
    actorRole: "admin"
  });
}

function createRoutingReason(
  providerTier: ModelProviderTier,
  costTier: ModelRoutingDecision["costTier"],
  requiresAdminReview: boolean
) {
  const review = requiresAdminReview ? " Admin review is required." : " Draft routing can proceed.";
  return `Recommended ${providerTier.replaceAll("_", " ")} at ${costTier.replaceAll("_", " ")} cost tier.${review}`;
}
