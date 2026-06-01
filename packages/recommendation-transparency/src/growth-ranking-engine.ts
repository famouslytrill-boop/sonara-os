import { buildRecommendationExplanation } from "./explanation-builder.ts";
import { evaluateRecommendationSafety } from "./recommendation-safety-gate.ts";
import { getAllowedSignalWeights } from "./signal-weight-registry.ts";
import type { RecommendationCandidate, RecommendationRanking } from "./types.ts";

export function rankRecommendations(
  candidates: readonly RecommendationCandidate[]
): readonly RecommendationRanking[] {
  return Object.freeze(
    candidates
      .map((candidate) => {
        const safety = evaluateRecommendationSafety(candidate);
        const explanation = buildRecommendationExplanation(candidate, safety);
        return Object.freeze({
          candidate,
          score: scoreCandidate(candidate, safety.status === "blocked"),
          safety,
          explanation
        });
      })
      .sort((left, right) => right.score - left.score)
  );
}

function scoreCandidate(candidate: RecommendationCandidate, blocked: boolean): number {
  if (blocked) {
    return 0;
  }
  const signalWeights = getAllowedSignalWeights();
  const signalScore = candidate.dataUsed.reduce((total, signal) => {
    const match = signalWeights.find((weight) => signal.includes(weight.signalKey));
    return total + (match?.weight ?? 0.25);
  }, 0);
  const confidenceMultiplier =
    candidate.confidence === "high" ? 1 : candidate.confidence === "medium" ? 0.75 : 0.5;
  const riskPenalty =
    candidate.riskLevel === "critical"
      ? 1
      : candidate.riskLevel === "high"
        ? 0.6
        : candidate.riskLevel === "medium"
          ? 0.25
          : 0;
  return Number(Math.max(0, signalScore * confidenceMultiplier - riskPenalty).toFixed(3));
}
