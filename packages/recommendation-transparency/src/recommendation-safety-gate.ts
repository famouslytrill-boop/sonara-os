import { assertNoSensitiveSignalUse } from "./signal-weight-registry.ts";
import type {
  RecommendationApprovalRequirement,
  RecommendationCandidate,
  RecommendationRiskLevel,
  RecommendationSafetyFinding
} from "./types.ts";

export const allowedRecommendationActions = Object.freeze([
  "complete_profile",
  "add_payment_link",
  "add_booking_link",
  "create_offer",
  "request_review_draft",
  "follow_up_with_customer_draft",
  "win_back_campaign_draft",
  "fix_missing_proof",
  "improve_page_copy",
  "resolve_security_warning",
  "finish_onboarding",
  "update_stale_offer",
  "respond_to_support_ticket",
  "check_failed_payment",
  "review_pending_approval"
]);

export const blockedRecommendationBehaviors = Object.freeze([
  "addictive_social_feed_mechanics",
  "manipulative_ranking",
  "discriminatory_targeting",
  "hidden_political_persuasion",
  "fake_urgency",
  "fake_scarcity",
  "fake_reviews",
  "sensitive_attribute_ranking",
  "customer_messaging_without_consent",
  "auto_sending_campaigns",
  "predatory_pricing_pressure"
]);

export function evaluateRecommendationSafety(
  candidate: RecommendationCandidate
): RecommendationSafetyFinding {
  const reasons: string[] = [];
  let approvalRequirement: RecommendationApprovalRequirement = "no_approval_needed";
  let riskLevel: RecommendationRiskLevel = candidate.riskLevel;

  if (!allowedRecommendationActions.includes(candidate.actionKey)) {
    approvalRequirement = "blocked";
    riskLevel = "critical";
    reasons.push("Unknown or unsupported recommendation actions are blocked.");
  }
  if (candidate.usesSensitiveAttributes || !assertNoSensitiveSignalUse(candidate.dataUsed)) {
    approvalRequirement = "blocked";
    riskLevel = "critical";
    reasons.push("Sensitive personal attributes cannot be used for recommendation ranking.");
  }
  if (candidate.usesFakeUrgency || candidate.usesFakeScarcity || candidate.mentionsFakeReviews) {
    approvalRequirement = "blocked";
    riskLevel = "critical";
    reasons.push("Fake urgency, fake scarcity, and fake reviews are blocked.");
  }
  if (candidate.autoExecutes) {
    approvalRequirement = "blocked";
    riskLevel = "critical";
    reasons.push("Recommendations may not auto-execute actions.");
  }
  if (candidate.customerFacing && (!candidate.requiresConsent || !candidate.hasConsent)) {
    approvalRequirement = "blocked";
    riskLevel = "critical";
    reasons.push("Customer-facing recommendations require consent and cannot send automatically.");
  } else if (candidate.customerFacing || candidate.riskLevel === "high") {
    approvalRequirement =
      approvalRequirement === "blocked" ? approvalRequirement : "owner_review_required";
    reasons.push("Customer-facing or high-risk actions must route to Owner Confirmation Lock.");
  }
  if (reasons.length === 0) {
    reasons.push("Recommendation is advisory and does not execute risky actions.");
  }

  return Object.freeze({
    actionKey: candidate.actionKey,
    status:
      approvalRequirement === "blocked"
        ? "blocked"
        : approvalRequirement === "owner_review_required"
          ? "requires_owner_review"
          : "allowed",
    riskLevel,
    approvalRequirement,
    reasons: Object.freeze(reasons)
  });
}
