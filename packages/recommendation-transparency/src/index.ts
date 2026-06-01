export * from "./types.ts";
export {
  assertNoSensitiveSignalUse,
  blockedSensitiveSignalKeys,
  getAllowedSignalWeights,
  getBlockedSignalWeights,
  signalWeightRegistry
} from "./signal-weight-registry.ts";
export { rankRecommendations } from "./growth-ranking-engine.ts";
export {
  createDefaultRecommendationCandidates,
  createNextBestActions
} from "./next-best-action-engine.ts";
export {
  allowedRecommendationActions,
  blockedRecommendationBehaviors,
  evaluateRecommendationSafety
} from "./recommendation-safety-gate.ts";
export { buildRecommendationExplanation } from "./explanation-builder.ts";
export { createRankingAuditEvent, createRankingAuditLedger } from "./ranking-audit-ledger.ts";

export const RecommendationTransparencyEngine = Object.freeze({
  publicName: "Recommendation Transparency",
  status: "setup_mode",
  safetyRule: "Recommendations explain, rank, and queue. They do not auto-execute risky actions."
});

export const GrowthRankingEngine = Object.freeze({ status: "setup_mode" });
export const NextBestActionEngine = Object.freeze({ status: "setup_mode" });
export const RankingAuditLedger = Object.freeze({ status: "audit_ready" });
export const RecommendationSafetyGate = Object.freeze({ status: "enabled" });
export const SignalWeightRegistry = Object.freeze({ status: "enabled" });
export const ExplanationBuilder = Object.freeze({ status: "enabled" });
