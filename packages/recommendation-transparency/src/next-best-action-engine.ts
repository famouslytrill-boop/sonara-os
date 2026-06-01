import { rankRecommendations } from "./growth-ranking-engine.ts";
import type {
  RecommendationCandidate,
  RecommendationProductArea,
  RecommendationRanking
} from "./types.ts";

export function createDefaultRecommendationCandidates(
  productArea: RecommendationProductArea
): readonly RecommendationCandidate[] {
  const base = (input: Omit<RecommendationCandidate, "productArea" | "metadata">) =>
    Object.freeze({ ...input, productArea, metadata: Object.freeze({ source: "setup_mode" }) });

  return Object.freeze([
    base({
      actionKey: "complete_profile",
      title: "Complete profile",
      expectedBusinessValue: "Gives customers enough context to understand the offer.",
      riskLevel: "low",
      confidence: "high",
      dataUsed: ["profile_missing_fields"],
      dataNotUsed: ["sensitive personal attributes", "private customer messages"],
      customerFacing: false,
      requiresConsent: false,
      hasConsent: false,
      autoExecutes: false,
      usesSensitiveAttributes: false,
      usesFakeUrgency: false,
      usesFakeScarcity: false,
      mentionsFakeReviews: false
    }),
    base({
      actionKey: "add_payment_link",
      title: "Add payment option",
      expectedBusinessValue: "Creates a clear path for hosted provider payment.",
      riskLevel: "medium",
      confidence: "high",
      dataUsed: ["payment_link_missing"],
      dataNotUsed: ["raw card data", "payout account details"],
      customerFacing: false,
      requiresConsent: false,
      hasConsent: false,
      autoExecutes: false,
      usesSensitiveAttributes: false,
      usesFakeUrgency: false,
      usesFakeScarcity: false,
      mentionsFakeReviews: false
    }),
    base({
      actionKey: "request_review_draft",
      title: "Draft review request",
      expectedBusinessValue: "Prepares a review request without sending it.",
      riskLevel: "high",
      confidence: "medium",
      dataUsed: ["review_request_ready"],
      dataNotUsed: ["private contact values", "sensitive personal attributes"],
      customerFacing: true,
      requiresConsent: true,
      hasConsent: true,
      autoExecutes: false,
      usesSensitiveAttributes: false,
      usesFakeUrgency: false,
      usesFakeScarcity: false,
      mentionsFakeReviews: false
    }),
    base({
      actionKey: "review_pending_approval",
      title: "Review pending approval",
      expectedBusinessValue: "Keeps sensitive actions from stalling launch decisions.",
      riskLevel: "medium",
      confidence: "high",
      dataUsed: ["pending_owner_approval"],
      dataNotUsed: ["secrets", "payout details"],
      customerFacing: false,
      requiresConsent: false,
      hasConsent: false,
      autoExecutes: false,
      usesSensitiveAttributes: false,
      usesFakeUrgency: false,
      usesFakeScarcity: false,
      mentionsFakeReviews: false
    })
  ]);
}

export function createNextBestActions(
  productArea: RecommendationProductArea
): readonly RecommendationRanking[] {
  return rankRecommendations(createDefaultRecommendationCandidates(productArea));
}
