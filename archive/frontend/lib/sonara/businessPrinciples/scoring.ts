import type { SonaraDecisionStatus, SonaraScoreSignal } from "../../../types/sonaraBusinessPrinciples";

export function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function weightedScore(signals: SonaraScoreSignal[]) {
  const totalWeight = signals.reduce((sum, signal) => sum + signal.weight, 0);
  if (totalWeight <= 0) return 0;
  return clampScore(signals.reduce((sum, signal) => sum + signal.score * signal.weight, 0) / totalWeight);
}

export function statusFromScore(score: number): SonaraDecisionStatus {
  if (score >= 78) return "clear";
  if (score >= 58) return "watch";
  return "hold";
}
