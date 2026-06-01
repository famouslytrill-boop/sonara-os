import { describe, expect, it } from "vitest";
import {
  createNextBestActions,
  evaluateRecommendationSafety,
  rankRecommendations,
  type RecommendationCandidate
} from "./index.ts";

const baseCandidate: RecommendationCandidate = {
  actionKey: "complete_profile",
  title: "Complete profile",
  productArea: "Business Builder",
  expectedBusinessValue: "Improve setup clarity.",
  riskLevel: "low",
  confidence: "high",
  dataUsed: ["profile_missing_fields"],
  dataNotUsed: ["sensitive personal attributes"],
  customerFacing: false,
  requiresConsent: false,
  hasConsent: false,
  autoExecutes: false,
  usesSensitiveAttributes: false,
  usesFakeUrgency: false,
  usesFakeScarcity: false,
  mentionsFakeReviews: false,
  metadata: {}
};

describe("recommendation transparency", () => {
  it("creates explainable next best actions", () => {
    const rankings = createNextBestActions("Business Builder");
    expect(rankings.length).toBeGreaterThan(0);
    expect(rankings[0].explanation.whySuggested).toContain("because");
    expect(rankings[0].explanation.dataNotUsed).toContain("sensitive personal attributes");
  });

  it("routes customer-facing recommendations to owner review", () => {
    const safety = evaluateRecommendationSafety({
      ...baseCandidate,
      actionKey: "request_review_draft",
      title: "Draft review request",
      riskLevel: "high",
      customerFacing: true,
      requiresConsent: true,
      hasConsent: true
    });
    expect(safety.approvalRequirement).toBe("owner_review_required");
  });

  it("blocks auto-execution, fake reviews, and sensitive attribute ranking", () => {
    for (const candidate of [
      { ...baseCandidate, autoExecutes: true },
      { ...baseCandidate, mentionsFakeReviews: true },
      { ...baseCandidate, usesSensitiveAttributes: true },
      { ...baseCandidate, dataUsed: ["race"] }
    ]) {
      expect(evaluateRecommendationSafety(candidate).approvalRequirement).toBe("blocked");
    }
  });

  it("blocks unknown actions instead of defaulting them to safe recommendations", () => {
    const safety = evaluateRecommendationSafety({
      ...baseCandidate,
      actionKey: "optimize_addictive_feed"
    });

    expect(safety.approvalRequirement).toBe("blocked");
    expect(safety.riskLevel).toBe("critical");
  });

  it("ranks blocked recommendations at zero", () => {
    const [ranking] = rankRecommendations([{ ...baseCandidate, autoExecutes: true }]);
    expect(ranking.score).toBe(0);
    expect(ranking.explanation.nextAction).toContain("Do not execute");
  });
});
