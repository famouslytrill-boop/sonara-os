export type AiCostDecision = Readonly<{
  estimatedUsd: number;
  allowed: boolean;
  ownerApprovalRequired: boolean;
  reason: string;
}>;

export const aiCostControlFeatureFlags = Object.freeze({
  AI_COST_CONTROL_ENABLED: true,
  AUTO_RUN_EXPENSIVE_AI_JOBS: false,
  OWNER_APPROVAL_REQUIRED_FOR_EXPENSIVE_RUNS: true
});

export const aiCostThresholds = Object.freeze({
  ownerApprovalUsd: 5,
  blockedUntilReviewedUsd: 50
});

export function evaluateAiRunCost(estimatedUsd: number): AiCostDecision {
  if (estimatedUsd >= aiCostThresholds.blockedUntilReviewedUsd) {
    return decision(estimatedUsd, false, true, "High-cost AI run is blocked until owner review.");
  }
  if (estimatedUsd >= aiCostThresholds.ownerApprovalUsd) {
    return decision(estimatedUsd, false, true, "Owner approval is required for expensive AI runs.");
  }
  return decision(estimatedUsd, true, false, "Low-cost draft run is allowed in setup policy.");
}

function decision(
  estimatedUsd: number,
  allowed: boolean,
  ownerApprovalRequired: boolean,
  reason: string
): AiCostDecision {
  return Object.freeze({ estimatedUsd, allowed, ownerApprovalRequired, reason });
}
