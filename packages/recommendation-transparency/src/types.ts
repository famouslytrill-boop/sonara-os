export type RecommendationProductArea =
  | "Business Builder"
  | "Creator Studio"
  | "Growth Studio"
  | "Owner Command Center"
  | "Autopilot Board"
  | "Security Center";

export type RecommendationActionKey =
  | "complete_profile"
  | "add_payment_link"
  | "add_booking_link"
  | "create_offer"
  | "request_review_draft"
  | "follow_up_with_customer_draft"
  | "win_back_campaign_draft"
  | "fix_missing_proof"
  | "improve_page_copy"
  | "resolve_security_warning"
  | "finish_onboarding"
  | "update_stale_offer"
  | "respond_to_support_ticket"
  | "check_failed_payment"
  | "review_pending_approval";

export type RecommendationRiskLevel = "low" | "medium" | "high" | "critical";
export type RecommendationConfidence = "low" | "medium" | "high";
export type RecommendationApprovalRequirement =
  | "no_approval_needed"
  | "owner_review_required"
  | "blocked";

export type RecommendationCandidate = Readonly<{
  actionKey: RecommendationActionKey | string;
  title: string;
  productArea: RecommendationProductArea;
  expectedBusinessValue: string;
  riskLevel: RecommendationRiskLevel;
  confidence: RecommendationConfidence;
  dataUsed: readonly string[];
  dataNotUsed: readonly string[];
  customerFacing: boolean;
  requiresConsent: boolean;
  hasConsent: boolean;
  autoExecutes: boolean;
  usesSensitiveAttributes: boolean;
  usesFakeUrgency: boolean;
  usesFakeScarcity: boolean;
  mentionsFakeReviews: boolean;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type SignalWeight = Readonly<{
  signalKey: string;
  label: string;
  weight: number;
  allowed: boolean;
  reason: string;
}>;

export type RecommendationSafetyFinding = Readonly<{
  actionKey: string;
  status: "allowed" | "requires_owner_review" | "blocked";
  riskLevel: RecommendationRiskLevel;
  approvalRequirement: RecommendationApprovalRequirement;
  reasons: readonly string[];
}>;

export type RecommendationExplanation = Readonly<{
  actionKey: string;
  title: string;
  whySuggested: string;
  productArea: RecommendationProductArea;
  expectedBusinessValue: string;
  riskLevel: RecommendationRiskLevel;
  approvalRequirement: RecommendationApprovalRequirement;
  dataUsed: readonly string[];
  dataNotUsed: readonly string[];
  confidence: RecommendationConfidence;
  nextAction: string;
}>;

export type RecommendationRanking = Readonly<{
  candidate: RecommendationCandidate;
  score: number;
  safety: RecommendationSafetyFinding;
  explanation: RecommendationExplanation;
}>;

export type RankingAuditEvent = Readonly<{
  id: string;
  actionKey: string;
  productArea: RecommendationProductArea;
  riskLevel: RecommendationRiskLevel;
  approvalRequirement: RecommendationApprovalRequirement;
  summary: string;
  createdAt: string;
  metadata: Readonly<Record<string, unknown>>;
}>;
