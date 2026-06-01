import type {
  RecommendationCandidate,
  RecommendationExplanation,
  RecommendationSafetyFinding
} from "./types.ts";

export function buildRecommendationExplanation(
  candidate: RecommendationCandidate,
  safety: RecommendationSafetyFinding
): RecommendationExplanation {
  return Object.freeze({
    actionKey: candidate.actionKey,
    title: candidate.title,
    whySuggested: createWhySuggested(candidate, safety),
    productArea: candidate.productArea,
    expectedBusinessValue: candidate.expectedBusinessValue,
    riskLevel: safety.riskLevel,
    approvalRequirement: safety.approvalRequirement,
    dataUsed: Object.freeze([...candidate.dataUsed]),
    dataNotUsed: Object.freeze([...candidate.dataNotUsed]),
    confidence: candidate.confidence,
    nextAction:
      safety.approvalRequirement === "blocked"
        ? "Do not execute. Review the blocked reason."
        : safety.approvalRequirement === "owner_review_required"
          ? "Prepare a draft and send it to Owner Review Queue."
          : "Prepare the setup task for owner review or manual completion."
  });
}

function createWhySuggested(
  candidate: RecommendationCandidate,
  safety: RecommendationSafetyFinding
): string {
  return `${candidate.title} is suggested for ${candidate.productArea} because ${candidate.dataUsed.join(
    ", "
  )}. Safety result: ${safety.status.replaceAll("_", " ")}.`;
}
