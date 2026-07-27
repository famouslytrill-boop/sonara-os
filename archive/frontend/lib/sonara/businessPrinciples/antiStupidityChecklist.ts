import type { SonaraBusinessSnapshot, SonaraInitiativeSnapshot, SonaraPrincipleResult } from "../../../types/sonaraBusinessPrinciples";
import { clampScore, statusFromScore, weightedScore } from "./scoring";

const checklist = [
  "Does this preserve beginner clarity?",
  "Does this avoid income, hit, placement, or market dominance claims?",
  "Does this avoid legal, tax, medical, and investment advice?",
  "Can SONARA™ deliver this without damaging support quality?",
  "Is the workflow inside music technology, creator infrastructure, sound systems, release tools, artist ecosystems, creator workflows, or digital assets?",
] as const;

export function evaluateAntiStupidityChecklist(
  snapshot: SonaraBusinessSnapshot,
  initiative: SonaraInitiativeSnapshot,
): SonaraPrincipleResult {
  const claimScore = initiative.reputationRisk > 35 ? 45 : 92;
  const scopeScore = initiative.requiresAutonomousPosting || initiative.requiresHeavyGeneration ? 38 : 90;
  const supportScore = clampScore(100 - snapshot.supportHours * 0.8 - snapshot.featureCreepRisk * 0.4);
  const signals = [
    { label: "Claim safety", score: claimScore, weight: 0.35, rationale: checklist[1] },
    { label: "Scope safety", score: scopeScore, weight: 0.35, rationale: checklist[4] },
    { label: "Support safety", score: supportScore, weight: 0.3, rationale: checklist[3] },
  ];
  const score = weightedScore(signals);

  return {
    id: "anti-stupidity-checklist",
    name: "SONARA Anti-Stupidity Checklist™",
    score,
    status: statusFromScore(score),
    summary: "Stops preventable mistakes before they reach creators or public launch surfaces.",
    signals,
    actions: score >= 78 ? ["Pass checklist before shipping."] : checklist.map((item) => `Re-check: ${item}`),
  };
}
