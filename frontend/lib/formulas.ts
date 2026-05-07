export type FormulaStatus = "excellent" | "strong" | "watch" | "weak" | "risky" | "needs_review";

export type FormulaResult = {
  value: number;
  score?: number;
  status: FormulaStatus;
  explanation: string;
  inputsUsed: Record<string, number | boolean>;
  inputs: Record<string, number | boolean>;
  recommendedNextStep: string;
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

function scoreStatus(score: number): FormulaStatus {
  if (score >= 85) return "excellent";
  if (score >= 70) return "strong";
  if (score >= 50) return "watch";
  return "weak";
}

function riskStatus(score: number): FormulaStatus {
  if (score >= 70) return "risky";
  if (score >= 40) return "needs_review";
  return "strong";
}

function result(input: {
  value: number;
  score?: number;
  status: FormulaStatus;
  explanation: string;
  inputs: Record<string, number | boolean>;
  recommendedNextStep: string;
}): FormulaResult {
  return {
    value: round(input.value),
    score: input.score === undefined ? undefined : round(input.score),
    status: input.status,
    explanation: input.explanation,
    inputsUsed: input.inputs,
    inputs: input.inputs,
    recommendedNextStep: input.recommendedNextStep,
  };
}

export function readinessScore(input: {
  completedChecks: number;
  totalChecks: number;
  criticalBlockers: number;
  assetCompleteness: number;
  approvalCompleteness: number;
}): FormulaResult {
  const completion = input.totalChecks ? (input.completedChecks / input.totalChecks) * 100 : 0;
  const score = clamp(
    weightedAverage([
      { value: completion, weight: 0.45 },
      { value: input.assetCompleteness, weight: 0.3 },
      { value: input.approvalCompleteness, weight: 0.25 },
    ]) - input.criticalBlockers * 15,
  );

  return result({
    value: score,
    score,
    status: input.criticalBlockers > 0 && score < 70 ? "needs_review" : scoreStatus(score),
    explanation: "Readiness blends checklist completion, asset completeness, approval completeness, and critical blocker penalties.",
    inputs: input,
    recommendedNextStep: "Clear blockers and approval gaps before public launch or export.",
  });
}

export function laborCostPercentage(input: { laborCost: number; netSales: number }): FormulaResult {
  const value = input.netSales > 0 ? (input.laborCost / input.netSales) * 100 : 0;
  const score = clamp(100 - Math.max(0, value - 25) * 4);
  return result({
    value,
    score,
    status: value <= 30 ? "strong" : value <= 36 ? "watch" : "risky",
    explanation: "Labor cost percentage is labor cost divided by net sales. Targets vary by restaurant model.",
    inputs: input,
    recommendedNextStep: "Review staffing, projected sales, and overtime before publishing the schedule.",
  });
}

export function contributionMargin(input: { price: number; variableCost: number }): FormulaResult {
  const value = input.price - input.variableCost;
  const marginPercent = input.price > 0 ? (value / input.price) * 100 : 0;
  return result({
    value,
    score: clamp(marginPercent),
    status: scoreStatus(marginPercent),
    explanation: "Contribution margin is price minus variable cost. The score is the margin percentage normalized to 0-100.",
    inputs: input,
    recommendedNextStep: "Validate margin before adding paid acquisition, discounts, or marketplace fees.",
  });
}

export function breakEvenUnits(input: { fixedCosts: number; price: number; variableCost: number }): FormulaResult {
  const margin = input.price - input.variableCost;
  const value = margin > 0 ? Math.ceil(input.fixedCosts / margin) : 0;
  return result({
    value,
    score: margin > 0 ? 100 : 0,
    status: margin > 0 ? "strong" : "risky",
    explanation: "Break-even units are fixed costs divided by contribution margin per unit. Zero margin blocks break-even.",
    inputs: input,
    recommendedNextStep: margin > 0 ? "Check whether the market can support the needed volume." : "Raise price or lower variable costs before selling.",
  });
}

export function alertRiskScore(input: {
  sourceTrust: number;
  publicImpact: number;
  urgency: number;
  ambiguity: number;
  approvalMissing: number;
}): FormulaResult {
  const value = clamp(
    weightedAverage([
      { value: 100 - input.sourceTrust, weight: 0.3 },
      { value: input.publicImpact, weight: 0.25 },
      { value: input.urgency, weight: 0.15 },
      { value: input.ambiguity, weight: 0.2 },
      { value: input.approvalMissing, weight: 0.1 },
    ]),
  );

  return result({
    value,
    score: value,
    status: riskStatus(value),
    explanation: "Alert risk rises when trust is low, public impact is high, urgency is high, ambiguity is high, or approval is missing.",
    inputs: input,
    recommendedNextStep: "Queue public notices and alerts for human approval before publishing.",
  });
}

export function moatScore(input: {
  switchingCosts: number;
  dataAdvantage: number;
  networkEffects: number;
  brandDefensibility: number;
  workflowIntegration: number;
  complianceFriction: number;
}): FormulaResult {
  const score = clamp(
    weightedAverage([
      { value: input.switchingCosts, weight: 0.18 },
      { value: input.dataAdvantage, weight: 0.18 },
      { value: input.networkEffects, weight: 0.14 },
      { value: input.brandDefensibility, weight: 0.16 },
      { value: input.workflowIntegration, weight: 0.24 },
      { value: input.complianceFriction, weight: 0.1 },
    ]),
  );
  return result({
    value: score,
    score,
    status: scoreStatus(score),
    explanation: "Moat score estimates defensibility from switching costs, data advantage, network effects, brand defensibility, workflow integration, and compliance friction.",
    inputs: input,
    recommendedNextStep: "Deepen workflow integration before relying on brand or distribution alone.",
  });
}

export function shiftPlacementScore(input: {
  skillMatch: number;
  availabilityMatch: number;
  overtimeRisk: number;
  certificationMatch: number;
  fairnessBalance: number;
}): FormulaResult {
  const score = clamp(
    weightedAverage([
      { value: input.skillMatch, weight: 0.3 },
      { value: input.availabilityMatch, weight: 0.25 },
      { value: 100 - input.overtimeRisk, weight: 0.2 },
      { value: input.certificationMatch, weight: 0.15 },
      { value: input.fairnessBalance, weight: 0.1 },
    ]),
  );
  return result({
    value: score,
    score,
    status: scoreStatus(score),
    explanation: "Shift placement balances skill, availability, overtime risk, certification needs, and fairness.",
    inputs: input,
    recommendedNextStep: "Manager should review placements with low certification fit or high overtime risk.",
  });
}

export function menuMargin(input: { menuPrice: number; foodCost: number; packagingCost?: number }): FormulaResult {
  const normalizedInput = { ...input, packagingCost: input.packagingCost ?? 0 };
  const totalCost = normalizedInput.foodCost + normalizedInput.packagingCost;
  const percentage = normalizedInput.menuPrice > 0 ? ((normalizedInput.menuPrice - totalCost) / normalizedInput.menuPrice) * 100 : 0;
  return result({
    value: percentage,
    score: clamp(percentage),
    status: scoreStatus(percentage),
    explanation: "Menu margin is menu price minus food and packaging cost, expressed as a percentage of menu price.",
    inputs: normalizedInput,
    recommendedNextStep: "Reprice or adjust recipe cost if margin falls below target.",
  });
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
  return result({
    value,
    score: value,
    status: riskStatus(value),
    explanation: "Bottleneck score rises with waiting work, blocked approvals, item age, and limited team capacity.",
    inputs: input,
    recommendedNextStep: "Clear oldest blocked approvals before adding more automation.",
  });
}

export function pricingFloor(input: { variableCost: number; targetMarginPercent: number; platformFeePercent?: number }): FormulaResult {
  const normalizedInput = { ...input, platformFeePercent: input.platformFeePercent ?? 0 };
  const fee = normalizedInput.platformFeePercent / 100;
  const targetMargin = clamp(normalizedInput.targetMarginPercent, 0, 95) / 100;
  const denominator = 1 - targetMargin - fee;
  const value = denominator > 0 ? normalizedInput.variableCost / denominator : 0;
  return result({
    value,
    score: denominator > 0 ? 100 : 0,
    status: denominator > 0 ? "strong" : "risky",
    explanation: "Pricing floor estimates minimum price needed to cover variable cost, target margin, and platform fees.",
    inputs: normalizedInput,
    recommendedNextStep: denominator > 0 ? "Validate market willingness to pay above this floor." : "Lower fees or target margin before pricing.",
  });
}

export function forecastConfidence(input: {
  dataHistoryDays: number;
  sampleSize: number;
  volatility: number;
  missingFields: number;
}): FormulaResult {
  const score = clamp(
    weightedAverage([
      { value: clamp((input.dataHistoryDays / 90) * 100), weight: 0.3 },
      { value: clamp((input.sampleSize / 100) * 100), weight: 0.3 },
      { value: 100 - input.volatility, weight: 0.25 },
      { value: 100 - input.missingFields * 12, weight: 0.15 },
    ]),
  );
  return result({
    value: score,
    score,
    status: scoreStatus(score),
    explanation: "Forecast confidence increases with history and sample size, and decreases with volatility and missing fields. It is not a guarantee.",
    inputs: input,
    recommendedNextStep: "Mark low-confidence projections as directional and keep human review.",
  });
}

export function contentQualityScore(input: {
  originality: number;
  specificity: number;
  usefulness: number;
  completeness: number;
  riskFlags: number;
}): FormulaResult {
  const score = clamp(weightedAverage([
    { value: input.originality, weight: 0.25 },
    { value: input.specificity, weight: 0.25 },
    { value: input.usefulness, weight: 0.25 },
    { value: input.completeness, weight: 0.20 },
    { value: 100 - input.riskFlags * 20, weight: 0.05 },
  ]));
  return result({
    value: score,
    score,
    status: input.riskFlags > 0 ? "needs_review" : scoreStatus(score),
    explanation: "Content quality rewards original, specific, useful, complete content and penalizes risk flags.",
    inputs: input,
    recommendedNextStep: "Keep low-quality generated content in draft until a human improves it.",
  });
}

export function pageQualityScore(input: {
  contentQuality: number;
  purposeClarity: number;
  internalLinks: number;
  duplicateRisk: number;
  approvalReadiness: number;
}): FormulaResult {
  const score = clamp(weightedAverage([
    { value: input.contentQuality, weight: 0.35 },
    { value: input.purposeClarity, weight: 0.25 },
    { value: clamp(input.internalLinks * 20), weight: 0.10 },
    { value: 100 - input.duplicateRisk, weight: 0.15 },
    { value: input.approvalReadiness, weight: 0.15 },
  ]));
  return result({
    value: score,
    score,
    status: score >= 70 ? scoreStatus(score) : "needs_review",
    explanation: "Page quality checks usefulness, clear purpose, healthy internal links, duplicate risk, and approval readiness.",
    inputs: input,
    recommendedNextStep: "Publish only pages above the quality threshold; keep thin or duplicate pages in draft.",
  });
}

export function seoUsefulnessScore(input: {
  searchIntentFit: number;
  localRelevance: number;
  expertiseEvidence: number;
  thinContentRisk: number;
}): FormulaResult {
  const score = clamp(weightedAverage([
    { value: input.searchIntentFit, weight: 0.30 },
    { value: input.localRelevance, weight: 0.20 },
    { value: input.expertiseEvidence, weight: 0.30 },
    { value: 100 - input.thinContentRisk, weight: 0.20 },
  ]));
  return result({
    value: score,
    score,
    status: scoreStatus(score),
    explanation: "SEO usefulness favors intent fit, local relevance, expertise evidence, and low thin-content risk.",
    inputs: input,
    recommendedNextStep: "Do not publish search pages that do not answer a real user problem.",
  });
}

export function customerSupportPriorityScore(input: {
  customerImpact: number;
  urgency: number;
  revenueRisk: number;
  repeatReports: number;
  workaroundAvailable: boolean;
}): FormulaResult {
  const score = clamp(weightedAverage([
    { value: input.customerImpact, weight: 0.35 },
    { value: input.urgency, weight: 0.25 },
    { value: input.revenueRisk, weight: 0.20 },
    { value: clamp(input.repeatReports * 15), weight: 0.10 },
    { value: input.workaroundAvailable ? 20 : 100, weight: 0.10 },
  ]));
  return result({
    value: score,
    score,
    status: riskStatus(score),
    explanation: "Support priority rises with customer impact, urgency, revenue risk, repeated reports, and lack of workaround.",
    inputs: input,
    recommendedNextStep: "Route risky support issues to an owner or manager before promising resolution dates.",
  });
}

export function operationalAutomationSafetyScore(input: {
  roleRisk: number;
  publicImpact: number;
  reversibility: number;
  approvalPresent: boolean;
  auditability: number;
}): FormulaResult {
  const risk = clamp(weightedAverage([
    { value: input.roleRisk, weight: 0.20 },
    { value: input.publicImpact, weight: 0.25 },
    { value: 100 - input.reversibility, weight: 0.25 },
    { value: input.approvalPresent ? 0 : 100, weight: 0.20 },
    { value: 100 - input.auditability, weight: 0.10 },
  ]));
  return result({
    value: risk,
    score: 100 - risk,
    status: riskStatus(risk),
    explanation: "Automation safety scores role risk, public impact, reversibility, approval presence, and auditability.",
    inputs: input,
    recommendedNextStep: "Queue risky automation for approval and audit the result.",
  });
}

export function sourceTrustScore(input: {
  verificationScore: number;
  historyScore: number;
  correctionRate: number;
  sourceTransparency: number;
}): FormulaResult {
  const score = clamp(weightedAverage([
    { value: input.verificationScore, weight: 0.35 },
    { value: input.historyScore, weight: 0.25 },
    { value: 100 - input.correctionRate, weight: 0.20 },
    { value: input.sourceTransparency, weight: 0.20 },
  ]));
  return result({
    value: score,
    score,
    status: scoreStatus(score),
    explanation: "Source trust blends verification, history, correction rate, and transparency.",
    inputs: input,
    recommendedNextStep: "Re-check sources below strong confidence before public notices rely on them.",
  });
}

export function approvalRiskScore(input: {
  publicImpact: number;
  dataSensitivity: number;
  financialImpact: number;
  reversibility: number;
  actorRoleRisk: number;
}): FormulaResult {
  const risk = clamp(weightedAverage([
    { value: input.publicImpact, weight: 0.25 },
    { value: input.dataSensitivity, weight: 0.25 },
    { value: input.financialImpact, weight: 0.20 },
    { value: 100 - input.reversibility, weight: 0.15 },
    { value: input.actorRoleRisk, weight: 0.15 },
  ]));
  return result({
    value: risk,
    score: 100 - risk,
    status: riskStatus(risk),
    explanation: "Approval risk rises with public impact, sensitive data, financial impact, low reversibility, and risky actor role.",
    inputs: input,
    recommendedNextStep: "Require owner/admin approval for risky actions before execution.",
  });
}
