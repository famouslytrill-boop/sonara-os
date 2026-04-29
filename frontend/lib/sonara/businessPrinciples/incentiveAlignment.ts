import type { SonaraBusinessSnapshot, SonaraPrincipleResult } from "../../../types/sonaraBusinessPrinciples";
import { clampScore, statusFromScore, weightedScore } from "./scoring";

export function evaluateIncentiveAlignment(snapshot: SonaraBusinessSnapshot): SonaraPrincipleResult {
  const qualityScore = clampScore(snapshot.qualityRewardShare * 260);
  const clarityScore = snapshot.teamIncentiveClarity;
  const supportScore = clampScore(100 - snapshot.supportHours * 0.7);
  const signals = [
    {
      label: "Quality reward share",
      score: qualityScore,
      weight: 0.35,
      rationale: "Rewards should favor durable creator outcomes, not rushed volume.",
    },
    {
      label: "Team incentive clarity",
      score: clarityScore,
      weight: 0.45,
      rationale: "Teams should know which behaviors protect the creator and the company.",
    },
    {
      label: "Support load",
      score: supportScore,
      weight: 0.2,
      rationale: "Rising support load can reveal misaligned promises or confusing workflows.",
    },
  ];
  const score = weightedScore(signals);

  return {
    id: "incentive-alignment",
    name: "SONARA Incentive Alignment Engine™",
    score,
    status: statusFromScore(score),
    summary: "Rewards quality, clean handoffs, and creator trust over noisy growth.",
    signals,
    actions: score >= 78 ? ["Maintain quality-weighted incentives."] : ["Tie rewards to retention, clear exports, low rework, and creator trust."],
  };
}
