import type { SonaraBusinessSnapshot, SonaraInitiativeSnapshot, SonaraPrincipleResult } from "../../../types/sonaraBusinessPrinciples";
import { clampScore, statusFromScore, weightedScore } from "./scoring";

export function evaluateTrustReputationLedger(
  snapshot: SonaraBusinessSnapshot,
  initiative: SonaraInitiativeSnapshot,
): SonaraPrincipleResult {
  const incidentScore = clampScore(100 - snapshot.trustIncidentCount * 24);
  const refundScore = clampScore(100 - snapshot.refundRate * 320);
  const initiativeRiskScore = clampScore(100 - initiative.reputationRisk * 1.4);
  const signals = [
    {
      label: "Incident ledger",
      score: incidentScore,
      weight: 0.35,
      rationale: "Trust incidents should reduce launch appetite until the root cause is fixed.",
    },
    {
      label: "Refund pressure",
      score: refundScore,
      weight: 0.25,
      rationale: "Refund pressure can reveal product promise or delivery drift.",
    },
    {
      label: "Initiative reputation risk",
      score: initiativeRiskScore,
      weight: 0.4,
      rationale: "Public workflows must preserve creator rights, consent, and expectation clarity.",
    },
  ];
  const score = weightedScore(signals);

  return {
    id: "trust-reputation-ledger",
    name: "SONARA Trust & Reputation Ledger™",
    score,
    status: statusFromScore(score),
    summary: "Tracks trust as a core company asset before adding more automation, marketplace, or public workflow surface.",
    signals,
    actions: score >= 78 ? ["Keep trust controls in the launch checklist."] : ["Pause expansion until incidents, refunds, and public-risk wording are corrected."],
  };
}
