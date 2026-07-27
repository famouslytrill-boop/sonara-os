import { sonaraMarginOfSafetyRules } from "../../../config/sonara/marginOfSafetyRules";
import type { SonaraBusinessSnapshot, SonaraInitiativeSnapshot, SonaraPrincipleResult } from "../../../types/sonaraBusinessPrinciples";
import { clampScore, statusFromScore, weightedScore } from "./scoring";

export function evaluateMarginOfSafety(
  snapshot: SonaraBusinessSnapshot,
  initiative: SonaraInitiativeSnapshot,
): SonaraPrincipleResult {
  const trustScore = clampScore(100 - snapshot.trustIncidentCount * 18 - snapshot.refundRate * 280);
  const marginScore = clampScore(100 - initiative.marginPressure - snapshot.featureCreepRisk * 0.45);
  const beginnerFocusScore = clampScore(100 - initiative.complexity * 0.55);
  const signals = [
    {
      label: sonaraMarginOfSafetyRules[0].label,
      score: beginnerFocusScore,
      weight: 0.25,
      rationale: sonaraMarginOfSafetyRules[0].description,
    },
    {
      label: sonaraMarginOfSafetyRules[1].label,
      score: marginScore,
      weight: 0.35,
      rationale: sonaraMarginOfSafetyRules[1].description,
    },
    {
      label: sonaraMarginOfSafetyRules[2].label,
      score: trustScore,
      weight: 0.4,
      rationale: sonaraMarginOfSafetyRules[2].description,
    },
  ];
  const score = weightedScore(signals);

  return {
    id: "margin-of-safety",
    name: "SONARA Margin of Safety Engine™",
    score,
    status: statusFromScore(score),
    summary: "Protects margins, trust, and beginner focus before allowing expansion.",
    signals,
    actions: score >= 78 ? ["Allow the initiative through the current phase gate."] : ["Reduce complexity, improve trust controls, or raise delivery margin before launch."],
  };
}
