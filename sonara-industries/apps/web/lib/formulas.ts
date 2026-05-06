const EPSILON = 1e-6;

export function clamp(value: number, low = 0, high = 100) {
  return Math.max(low, Math.min(high, value));
}

export function geometricWeightedScore(scores: Record<string, number>, weights: Record<string, number>) {
  const totalWeight = Object.values(weights).reduce((sum, weight) => sum + Math.max(weight, 0), 0);
  if (totalWeight <= 0) return 0;
  const factors = Object.entries(scores)
    .map(([key, score]) => {
      const weight = Math.max(weights[key] ?? 0, 0);
      if (weight === 0) return null;
      return Math.max(clamp(score) / 100, EPSILON) ** (weight / totalWeight);
    })
    .filter((value): value is number => value !== null);
  if (factors.length === 0) return 0;
  return Number((clamp(factors.reduce((product, value) => product * value, 1) * 100)).toFixed(2));
}

export function readinessScore(checks: Record<string, number>) {
  return geometricWeightedScore(checks, {
    metadata: 1.2,
    rights: 1.4,
    assets: 1,
    strategy: 0.9,
    quality: 1.1,
    approval: 1.5,
  });
}

export function laborPercentage(totalLaborCost: number, projectedSales: number) {
  if (projectedSales <= 0) return 0;
  return Number(((totalLaborCost / projectedSales) * 100).toFixed(2));
}

export function recipeCost(ingredientCosts: number[], servings: number) {
  if (servings <= 0) return 0;
  return Number((ingredientCosts.reduce((sum, cost) => sum + Math.max(cost, 0), 0) / servings).toFixed(2));
}

export function menuTargetPrice(costPerServing: number, targetFoodCostPercent: number) {
  if (targetFoodCostPercent <= 0) return 0;
  return Number((costPerServing / (targetFoodCostPercent / 100)).toFixed(2));
}

export function alertSeverity(hazard: number, proximity: number, urgency: number, sourceTrust: number) {
  return Number(clamp(hazard * 0.35 + proximity * 0.2 + urgency * 0.3 + sourceTrust * 0.15).toFixed(2));
}

export function securityRisk(sensitivity: number, exposure: number, automationPower: number, sourceTrust: number) {
  return Number(clamp(sensitivity * 0.3 + exposure * 0.25 + automationPower * 0.25 + (100 - clamp(sourceTrust)) * 0.2).toFixed(2));
}

export function queueUtilization(arrivalRate: number, serviceRate: number) {
  if (serviceRate <= 0) return 1;
  return Number((arrivalRate / serviceRate).toFixed(4));
}

export function exponentialSmoothing(previousForecast: number, actual: number, alpha = 0.35) {
  const boundedAlpha = Math.max(0, Math.min(1, alpha));
  return Number((boundedAlpha * actual + (1 - boundedAlpha) * previousForecast).toFixed(4));
}

export function moatScore(inputs: {
  networkEffects: number;
  switchingCost: number;
  proprietaryData: number;
  brand: number;
  compliance: number;
  executionSpeed: number;
}) {
  return Number(
    clamp(
      inputs.networkEffects * 0.18
        + inputs.switchingCost * 0.2
        + inputs.proprietaryData * 0.2
        + inputs.brand * 0.14
        + inputs.compliance * 0.16
        + inputs.executionSpeed * 0.12,
    ).toFixed(2),
  );
}

export function pricingScore(costSavings: number, timeSavings: number, urgency: number, segmentFit: number) {
  return Number(clamp(costSavings * 0.3 + timeSavings * 0.25 + urgency * 0.2 + segmentFit * 0.25).toFixed(2));
}
