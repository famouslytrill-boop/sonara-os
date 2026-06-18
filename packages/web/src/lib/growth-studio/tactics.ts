export type GrowthTacticCategory =
  | "onboarding"
  | "notification_permission"
  | "pricing_paywall"
  | "review_rating"
  | "gamification"
  | "social_proof"
  | "competitor_research"
  | "app_store_conversion"
  | "landing_page_conversion"
  | "email_campaign"
  | "sms_campaign_placeholder"
  | "retention"
  | "referral"
  | "content_marketing"
  | "before_after_transformation";

export type GrowthTacticStatus = "draft" | "planned" | "in_progress" | "completed";
export type GrowthEffortLevel = "low" | "medium" | "high";
export type GrowthRiskLevel = "low" | "medium" | "high";

export type GrowthTactic = Readonly<{
  id: string;
  title: string;
  category: GrowthTacticCategory;
  description: string;
  expected_impact: string;
  effort_level: GrowthEffortLevel;
  risk_level: GrowthRiskLevel;
  required_assets: readonly string[];
  implementation_notes: string;
  status: GrowthTacticStatus;
  company_account_id: string;
  owner_user_id: string;
  created_at: string;
  updated_at: string;
}>;

export type GrowthChecklistTemplate = Readonly<{
  id: string;
  title: string;
  items: readonly string[];
}>;

export const growthTacticCategories: readonly GrowthTacticCategory[] = Object.freeze([
  "onboarding",
  "notification_permission",
  "pricing_paywall",
  "review_rating",
  "gamification",
  "social_proof",
  "competitor_research",
  "app_store_conversion",
  "landing_page_conversion",
  "email_campaign",
  "sms_campaign_placeholder",
  "retention",
  "referral",
  "content_marketing",
  "before_after_transformation"
]);

export const defaultGrowthTactics: readonly GrowthTactic[] = Object.freeze([
  tactic(
    "mobile-app-launch",
    "Mobile app launch checklist",
    "app_store_conversion",
    "Prepare app metadata, screenshots, privacy notes, support links, and review-ready release copy.",
    "Improves launch clarity without making approval claims.",
    "medium",
    "medium",
    ["app metadata", "screenshots", "privacy review"],
    "Use as a planning checklist only until app-store review is complete."
  ),
  tactic(
    "review-request",
    "Consent-safe review request",
    "review_rating",
    "Draft plain review request copy with opt-out and no pressure.",
    "Improves review workflow quality without fake-review behavior.",
    "low",
    "high",
    ["customer consent note", "review link", "owner approval"],
    "Never incentivize or publish reviews without disclosure and review."
  ),
  tactic(
    "landing-page-proof",
    "Landing page proof pass",
    "landing_page_conversion",
    "Add truthful proof, clearer service outcomes, and a simple next step.",
    "Improves customer understanding without guaranteed outcome claims.",
    "low",
    "low",
    ["proof points", "service summary"],
    "Keep claims verifiable and avoid fake urgency."
  )
]);

export const growthChecklistTemplates: readonly GrowthChecklistTemplate[] = Object.freeze([
  checklist("mobile-app-launch", "Mobile app launch checklist"),
  checklist("web-app-launch", "Web app launch checklist"),
  checklist("landing-page-conversion", "Landing page conversion checklist"),
  checklist("app-store-optimization", "App store optimization checklist"),
  checklist("onboarding-improvement", "Onboarding improvement checklist"),
  checklist("review-request", "Review request checklist"),
  checklist("notification-permission", "Notification permission checklist"),
  checklist("paywall-pricing-test", "Paywall/pricing test checklist"),
  checklist("social-proof", "Social proof checklist"),
  checklist("competitor-ad-research", "Competitor ad research checklist")
]);

export function updateGrowthTacticStatus(
  tacticRecord: GrowthTactic,
  status: GrowthTacticStatus,
  updatedAt = new Date().toISOString()
): GrowthTactic {
  return Object.freeze({ ...tacticRecord, status, updated_at: updatedAt });
}

function tactic(
  id: string,
  title: string,
  category: GrowthTacticCategory,
  description: string,
  expected_impact: string,
  effort_level: GrowthEffortLevel,
  risk_level: GrowthRiskLevel,
  required_assets: readonly string[],
  implementation_notes: string
): GrowthTactic {
  const now = "setup-mode";
  return Object.freeze({
    id,
    title,
    category,
    description,
    expected_impact,
    effort_level,
    risk_level,
    required_assets: Object.freeze([...required_assets]),
    implementation_notes,
    status: "draft",
    company_account_id: "local_growth_setup",
    owner_user_id: "local_owner_setup",
    created_at: now,
    updated_at: now
  });
}

function checklist(id: string, title: string): GrowthChecklistTemplate {
  return Object.freeze({
    id,
    title,
    items: Object.freeze([
      "Define the customer problem.",
      "Confirm required assets and permissions.",
      "Write truthful copy.",
      "Review safety and compliance notes.",
      "Define the test that proves it worked."
    ])
  });
}
