import type { RankingAuditEvent, RecommendationRanking } from "./types.ts";

export function createRankingAuditEvent(
  ranking: RecommendationRanking,
  createdAt = new Date().toISOString()
): RankingAuditEvent {
  return Object.freeze({
    id: `ranking_audit_${ranking.candidate.actionKey}_${createdAt}`,
    actionKey: ranking.candidate.actionKey,
    productArea: ranking.candidate.productArea,
    riskLevel: ranking.safety.riskLevel,
    approvalRequirement: ranking.safety.approvalRequirement,
    summary: ranking.explanation.whySuggested,
    createdAt,
    metadata: Object.freeze({
      score: ranking.score,
      dataUsed: ranking.explanation.dataUsed,
      dataNotUsed: ranking.explanation.dataNotUsed
    })
  });
}

export function createRankingAuditLedger(
  rankings: readonly RecommendationRanking[]
): readonly RankingAuditEvent[] {
  return Object.freeze(rankings.map((ranking) => createRankingAuditEvent(ranking)));
}
