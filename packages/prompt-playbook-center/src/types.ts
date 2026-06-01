export type PromptCategory =
  | "business_blueprint"
  | "landing_page_copy"
  | "value_offer"
  | "competitive_moat"
  | "launch_plan"
  | "mvp_validation"
  | "cold_outreach"
  | "ad_copy"
  | "sales_pitch"
  | "customer_response"
  | "report_summary"
  | "meeting_action_plan"
  | "seo_blog_outline"
  | "faq_builder"
  | "linkedin_caption"
  | "website_copy_improvement"
  | "job_description"
  | "professional_email"
  | "customer_feedback_analysis"
  | "content_calendar"
  | "business_tool_comparison"
  | "team_meeting_agenda"
  | "creator_release_plan"
  | "campaign_strategy"
  | "review_response"
  | "referral_campaign"
  | "support_reply"
  | "admin_report"
  | "security_summary"
  | "reliability_incident_summary"
  | "owner_daily_review";

export type PromptProductArea =
  | "business-builder"
  | "creator-studio"
  | "growth-studio"
  | "admin-command-center"
  | "security-center"
  | "reliability-center"
  | "legal-readiness"
  | "support"
  | "billing";

export type PromptTargetUser =
  | "business_owner"
  | "content_creator"
  | "growth_operator"
  | "admin"
  | "support"
  | "owner"
  | "billing_admin";

export type PromptRiskLevel = "low" | "medium" | "high" | "critical";
export type PromptApprovalStatus = "not_required" | "owner_review_required" | "blocked";

export type PromptInputField = Readonly<{
  id: string;
  label: string;
  type: "text" | "textarea" | "select";
  required: boolean;
  placeholder: string;
  options?: readonly string[];
}>;

export type PromptTemplate = Readonly<{
  id: string;
  name: string;
  product_area: PromptProductArea;
  category: PromptCategory;
  target_user: PromptTargetUser;
  input_fields: readonly PromptInputField[];
  prompt_goal: string;
  output_format: string;
  safety_notes: readonly string[];
  approval_required: boolean;
  risk_level: PromptRiskLevel;
  example_output_placeholder: string;
  created_at: string;
  updated_at: string;
}>;

export type PromptSafetyInput = Readonly<{
  text: string;
  product_area: PromptProductArea;
  category: PromptCategory;
  risk_level: PromptRiskLevel;
  public_facing: boolean;
  customer_facing: boolean;
}>;

export type PromptSafetyFinding = Readonly<{
  status: "allowed" | "owner_review_required" | "blocked";
  approval_status: PromptApprovalStatus;
  risk_level: PromptRiskLevel;
  reasons: readonly string[];
  blocked_terms: readonly string[];
}>;

export type PromptQualityScore = Readonly<{
  score: number;
  status: "strong" | "usable" | "needs_context" | "blocked";
  reasons: readonly string[];
}>;

export type PromptBuildRequest = Readonly<{
  template_id: string;
  role: PromptTargetUser;
  inputs: Readonly<Record<string, string>>;
  public_facing: boolean;
  customer_facing: boolean;
}>;

export type BuiltPrompt = Readonly<{
  template: PromptTemplate;
  prompt_preview: string;
  safety: PromptSafetyFinding;
  quality: PromptQualityScore;
  approval_required: boolean;
}>;

export type PromptUsageAuditEvent = Readonly<{
  id: string;
  template_id: string;
  product_area: PromptProductArea;
  category: PromptCategory;
  risk_level: PromptRiskLevel;
  approval_status: PromptApprovalStatus;
  summary: string;
  created_at: string;
  metadata: Readonly<Record<string, unknown>>;
}>;
