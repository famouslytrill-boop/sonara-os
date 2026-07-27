import type { SonaraBusinessSnapshot, SonaraPrincipleResult } from "../../../types/sonaraBusinessPrinciples";
import { clampScore, statusFromScore, weightedScore } from "./scoring";

export function calculateOwnerEarnings(snapshot: SonaraBusinessSnapshot) {
  const supportCost = snapshot.supportHours * snapshot.supportHourlyCost;
  const reinvestmentReserve = snapshot.monthlyRevenue * snapshot.reinvestmentReserveRate;
  const ownerEarnings = snapshot.monthlyRevenue - snapshot.directDeliveryCost - snapshot.toolCost - supportCost - reinvestmentReserve;
  const ownerEarningsMargin = snapshot.monthlyRevenue > 0 ? ownerEarnings / snapshot.monthlyRevenue : 0;

  return {
    supportCost,
    reinvestmentReserve,
    ownerEarnings,
    ownerEarningsMargin,
  };
}

export function evaluateOwnerEarnings(snapshot: SonaraBusinessSnapshot): SonaraPrincipleResult {
  const earnings = calculateOwnerEarnings(snapshot);
  const signals = [
    {
      label: "Owner earnings margin",
      score: clampScore(earnings.ownerEarningsMargin * 160),
      weight: 0.6,
      rationale: "Checks whether the model funds delivery, support, tools, and reinvestment before expanding scope.",
    },
    {
      label: "Pricing confidence",
      score: snapshot.pricingConfidence,
      weight: 0.4,
      rationale: "Low pricing confidence should slow feature expansion and packaging changes.",
    },
  ];
  const score = weightedScore(signals);

  return {
    id: "owner-earnings",
    name: "SONARA Owner Earnings Dashboard™",
    score,
    status: statusFromScore(score),
    summary: `Estimated operating surplus after delivery, tools, support, and reserve: $${Math.round(earnings.ownerEarnings).toLocaleString()}.`,
    signals,
    actions: score >= 78 ? ["Keep pricing discipline and preserve reinvestment reserve."] : ["Review packaging, support load, and tool costs before adding new commitments."],
  };
}
