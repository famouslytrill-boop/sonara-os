import type { ReleaseStrategyInput, ReleaseStrategyPlan } from "./releaseStrategyTypes";

export function buildReleaseStrategy(input: ReleaseStrategyInput): ReleaseStrategyPlan {
  const score = input.readinessScore ?? 50;
  return {
    positioning: `${input.title || "Untitled Project"} should lead with music identity, release readiness, and a clear listener moment.`,
    metadataPrep: ["Confirm title and creator spelling.", "Confirm clean/explicit label.", "Confirm credits and rights notes.", "Prepare cover art and short description."],
    rolloutSteps: score >= 80
      ? ["Export release pack.", "Schedule announcement content.", "Prepare listening session.", "Review store/pricing upsell path."]
      : ["Strengthen hook and audience notes.", "Review runtime target.", "Complete rights sheet.", "Export a draft release pack."],
    riskNotes: ["SONARA does not distribute music directly.", "No playlist, streaming, revenue, or approval outcome is guaranteed."],
    distributionReadyExport: ["metadata sheet", "release plan", "rights checklist", "broadcast kit", "visual direction"],
  };
}
