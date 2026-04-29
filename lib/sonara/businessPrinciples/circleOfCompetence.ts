import { sonaraCircleOfCompetence } from "../../../config/sonara/circleOfCompetence";
import type { SonaraInitiativeSnapshot, SonaraPrincipleResult } from "../../../types/sonaraBusinessPrinciples";
import { clampScore, statusFromScore, weightedScore } from "./scoring";

export function evaluateCircleOfCompetence(initiative: SonaraInitiativeSnapshot): SonaraPrincipleResult {
  const insideMatches = initiative.tags.filter((tag) => sonaraCircleOfCompetence.inside.includes(tag as never)).length;
  const outsideMatches = initiative.tags.filter((tag) => sonaraCircleOfCompetence.outside.includes(tag as never)).length;
  const focusScore = clampScore(72 + insideMatches * 6 - outsideMatches * 18 - initiative.complexity * 0.25);
  const riskScore = initiative.requiresHeavyGeneration || initiative.requiresAutonomousPosting ? 42 : 86;
  const signals = [
    {
      label: "Known operating zone",
      score: focusScore,
      weight: 0.65,
      rationale: "Rewards initiatives inside music identity, release tools, artist systems, and creator workflows.",
    },
    {
      label: "Boundary risk",
      score: riskScore,
      weight: 0.35,
      rationale: "Delays heavy generation or public automation until controls and trust gates are mature.",
    },
  ];
  const score = weightedScore(signals);

  return {
    id: "circle-of-competence",
    name: "SONARA Circle of Competence™",
    score,
    status: statusFromScore(score),
    summary: "Keeps SONARA™ inside the work it can execute with taste, trust, and operational clarity.",
    signals,
    actions: score >= 78 ? ["Proceed inside the current product door."] : ["Narrow scope to music identity, release tools, or creator workflows."],
  };
}
