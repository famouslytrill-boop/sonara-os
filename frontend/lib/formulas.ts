export type FormulaResult = {
  value: number;
  score?: number;
  status: "low" | "healthy" | "watch" | "high" | "blocked";
  explanation: string;
  inputs: Record<string, number>;
};

function round(value: number, precision = 2) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function weightedAverage(items: Array<{ value: number; weight: number }>) {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  if (!totalWeight) return 0;
  return items.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight;
}

export function readinessScore(input: {
  completedChecks: number;
  totalChecks: number;
  criticalBlockers: number;
  assetCompleteness: number;
  approvalCompleteness: number;
}): FormulaResult {
  const completion = input.totalChecks ? (input.completedChecks / input.totalChecks) * 100 : 0;
  const blockerPenalty = input.criticalBlockers * 15;
  const score = clamp(weightedAverage([
    { value: completion, weight: 0.45 },
    { value: input.assetCompleteness, weight: 0.3 },
    { value: input.approvalCompleteness, weight: 0.25 },
  ]) - blockerPenalty);

  return {
    value: round(score),
    score: round(score),
    status: score >= 80 ? "healthy" : score >= 60 ? "watch" : input.criticalBlockers ? "blocked" : "low",
    explanation: "Readiness blends checklist completion, asset completeness, approval completeness, and critical blocker penalties.",
    inputs: input,
  };
}

export function laborCostPercentage(input: { laborCost: number; netSales: number }): FormulaResult {
  const value = input.netSales > 0 ? (input.laborCost / input.netSales) * 100 : 0;
  return {
    value: round(value),
    score: round(clamp(100 - Math.max(0, value - 25) * 4)),
    status: value <= 30 ? "healthy" : value <= 36 ? "watch" : "high",
    explanation: "Labor cost percentage is labor cost divided by net sales. Lower is usually healthier, but targets vary by concept.",
    inputs: input,
  };
}

export function contributionMargin(input: { price: number; variableCost: number }): FormulaResult {
  const value = input.price - input.variableCost;
  const ratio = input.price > 0 ? (value / input.price) * 100 : 0;
  return {
    value: round(value),
    score: round(clamp(ratio)),
    status: ratio >= 65 ? "healthy" : ratio >= 50 ? "watch" : "low",
    explanation: "Contribution margin is price minus variable cost. The score is the margin percentage normalized to 0-100.",
    inputs: input,
  };
}

export function breakEvenUnits(input: { fixedCosts: number; price: number; variableCost: number }): FormulaResult {
  const margin = input.price - input.variableCost;
  const value = margin > 0 ? Math.ceil(input.fixedCosts / margin) : 0;
  return {
    value,
    status: margin > 0 ? "healthy" : "blocked",
    explanation: "Break-even units are fixed costs divided by contribution margin per unit. Zero margin blocks break-even.",
    inputs: input,
  };
}

export function alertRiskScore(input: {
  sourceTrust: number;
  publicImpact: number;
  urgency: number;
  ambiguity: number;
  approvalMissing: number;
}): FormulaResult {
  const value = clamp(weightedAverage([
    { value: 100 - input.sourceTrust, weight: 0.3 },
    { value: input.publicImpact, weight: 0.25 },
    { value: input.urgency, weight: 0.15 },
    { value: input.ambiguity, weight: 0.2 },
    { value: input.approvalMissing, weight: 0.1 },
  ]));

  return {
    value: round(value),
    score: round(value),
    status: value >= 70 ? "high" : value >= 40 ? "watch" : "healthy",
    explanation: "Alert risk rises when trust is low, public impact is high, language is ambiguous, urgency is high, or approval is missing.",
    inputs: input,
  };
}

export function moatScore(input: {
  workflowDepth: number;
  switchingCost: number;
  dataCompounding: number;
  distribution: number;
  trust: number;
}): FormulaResult {
  const score = clamp(weightedAverage([
    { value: input.workflowDepth, weight: 0.25 },
    { value: input.switchingCost, weight: 0.2 },
    { value: input.dataCompounding, weight: 0.2 },
    { value: input.distribution, weight: 0.15 },
    { value: input.trust, weight: 0.2 },
  ]));
  return {
    value: round(score),
    score: round(score),
    status: score >= 75 ? "healthy" : score >= 50 ? "watch" : "low",
    explanation: "Moat score estimates defensibility from workflow depth, switching cost, data compounding, distribution, and trust.",
    inputs: input,
  };
}

export function shiftPlacementScore(input: {
  skillMatch: number;
  availabilityMatch: number;
  overtimeRisk: number;
  certificationMatch: number;
  fairnessBalance: number;
}): FormulaResult {
  const score = clamp(weightedAverage([
    { value: input.skillMatch, weight: 0.3 },
    { value: input.availabilityMatch, weight: 0.25 },
    { value: 100 - input.overtimeRisk, weight: 0.2 },
    { value: input.certificationMatch, weight: 0.15 },
    { value: input.fairnessBalance, weight: 0.1 },
  ]));
  return {
    value: round(score),
    score: round(score),
    status: score >= 80 ? "healthy" : score >= 60 ? "watch" : "low",
    explanation: "Shift placement balances skill, availability, overtime risk, certification needs, and fairness.",
    inputs: input,
  };
}

export function menuMargin(input: { menuPrice: number; foodCost: number; packagingCost?: number }): FormulaResult {
  const totalCost = input.foodCost + (input.packagingCost ?? 0);
  const margin = input.menuPrice - totalCost;
  const percentage = input.menuPrice > 0 ? (margin / input.menuPrice) * 100 : 0;
  return {
    value: round(percentage),
    score: round(clamp(percentage)),
    status: percentage >= 65 ? "healthy" : percentage >= 50 ? "watch" : "low",
    explanation: "Menu margin is menu price minus food and packaging cost, expressed as a percentage of menu price.",
    inputs: { ...input, packagingCost: input.packagingCost ?? 0 },
  };
}

export function workflowBottleneckScore(input: {
  waitingItems: number;
  averageAgeHours: number;
  blockedApprovals: number;
  teamCapacity: number;
}): FormulaResult {
  const pressure = input.teamCapacity > 0 ? ((input.waitingItems + input.blockedApprovals * 2) / input.teamCapacity) * 45 : 100;
  const agePressure = Math.min(40, input.averageAgeHours / 2);
  const value = clamp(pressure + agePressure);
  return {
    value: round(value),
    score: round(value),
    status: value >= 70 ? "high" : value >= 40 ? "watch" : "healthy",
    explanation: "Bottleneck score rises with waiting work, blocked approvals, item age, and limited team capacity.",
    inputs: input,
  };
}

export function pricingFloor(input: { variableCost: number; targetMarginPercent: number; platformFeePercent?: number }): FormulaResult {
  const fee = (input.platformFeePercent ?? 0) / 100;
  const targetMargin = clamp(input.targetMarginPercent, 0, 95) / 100;
  const denominator = 1 - targetMargin - fee;
  const value = denominator > 0 ? input.variableCost / denominator : 0;
  return {
    value: round(value),
    status: denominator > 0 ? "healthy" : "blocked",
    explanation: "Pricing floor estimates minimum price needed to cover variable cost, target margin, and platform fees.",
    inputs: { ...input, platformFeePercent: input.platformFeePercent ?? 0 },
  };
}

export function forecastConfidence(input: {
  dataHistoryDays: number;
  sampleSize: number;
  volatility: number;
  missingFields: number;
}): FormulaResult {
  const score = clamp(weightedAverage([
    { value: clamp((input.dataHistoryDays / 90) * 100), weight: 0.3 },
    { value: clamp((input.sampleSize / 100) * 100), weight: 0.3 },
    { value: 100 - input.volatility, weight: 0.25 },
    { value: 100 - input.missingFields * 12, weight: 0.15 },
  ]));
  return {
    value: round(score),
    score: round(score),
    status: score >= 75 ? "healthy" : score >= 50 ? "watch" : "low",
    explanation: "Forecast confidence increases with history and sample size, and decreases with volatility and missing fields. It is not a guarantee.",
    inputs: input,
  };
}
