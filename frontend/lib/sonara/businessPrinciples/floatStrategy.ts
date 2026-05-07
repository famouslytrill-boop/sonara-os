import type { SonaraBusinessSnapshot, SonaraPrincipleResult } from "../../../types/sonaraBusinessPrinciples";
import { clampScore, statusFromScore, weightedScore } from "./scoring";

export function evaluateFloatStrategy(snapshot: SonaraBusinessSnapshot): SonaraPrincipleResult {
  const coverageRatio = snapshot.committedDeliveryCost > 0 ? snapshot.prepaidCreatorBalance / snapshot.committedDeliveryCost : 1;
  const reserveScore = clampScore(coverageRatio * 70);
  const refundBufferScore = clampScore(100 - snapshot.refundRate * 360);
  const signals = [
    {
      label: "Prepaid delivery coverage",
      score: reserveScore,
      weight: 0.55,
      rationale: "Creator prepayments should fund promised delivery without starving support or quality review.",
    },
    {
      label: "Refund buffer",
      score: refundBufferScore,
      weight: 0.45,
      rationale: "A healthy buffer protects creator trust if a release workflow needs correction.",
    },
  ];
  const score = weightedScore(signals);

  return {
    id: "float-strategy",
    name: "SONARA Float Strategy™",
    score,
    status: statusFromScore(score),
    summary: "Treats prepaid balances and reserves as delivery responsibility, not free expansion capital.",
    signals,
    actions: score >= 78 ? ["Keep reserves tied to delivery commitments."] : ["Hold expansion spend until prepaid obligations and refund buffer are stronger."],
  };
}
