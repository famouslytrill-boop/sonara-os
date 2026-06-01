import type {
  PromptCategory,
  PromptInputField,
  PromptProductArea,
  PromptTargetUser,
  PromptTemplate
} from "./types.ts";

const now = "2026-05-26T00:00:00.000Z";

export const promptCategories: readonly PromptCategory[] = Object.freeze([
  "business_blueprint",
  "landing_page_copy",
  "value_offer",
  "competitive_moat",
  "launch_plan",
  "mvp_validation",
  "cold_outreach",
  "ad_copy",
  "sales_pitch",
  "customer_response",
  "report_summary",
  "meeting_action_plan",
  "seo_blog_outline",
  "faq_builder",
  "linkedin_caption",
  "website_copy_improvement",
  "job_description",
  "professional_email",
  "customer_feedback_analysis",
  "content_calendar",
  "business_tool_comparison",
  "team_meeting_agenda",
  "creator_release_plan",
  "campaign_strategy",
  "review_response",
  "referral_campaign",
  "support_reply",
  "admin_report",
  "security_summary",
  "reliability_incident_summary",
  "owner_daily_review"
]);

export const promptProductAreas: readonly PromptProductArea[] = Object.freeze([
  "business-builder",
  "creator-studio",
  "growth-studio",
  "admin-command-center",
  "security-center",
  "reliability-center",
  "legal-readiness",
  "support",
  "billing"
]);

const sharedFields = Object.freeze([
  field("business_context", "Business context", "textarea", true, "What does the user do?"),
  field("audience", "Audience", "text", true, "Who is this for?"),
  field("goal", "Goal", "textarea", true, "What should the output help accomplish?")
]);

export const promptTemplateRegistry: readonly PromptTemplate[] = Object.freeze([
  template(
    "business_blueprint",
    "Business Blueprint Builder",
    "business-builder",
    "business_owner",
    [
      ...sharedFields,
      field("offer", "Primary offer", "text", true, "Main service, product, or package")
    ]
  ),
  template("landing_page_copy", "Landing Page Copy Draft", "business-builder", "business_owner", [
    ...sharedFields,
    field("call_to_action", "Call to action", "text", true, "Book a call, buy, request info")
  ]),
  template("value_offer", "Value Offer Builder", "business-builder", "business_owner", [
    ...sharedFields,
    field("proof", "Proof available", "textarea", false, "Real proof, examples, credentials")
  ]),
  template("competitive_moat", "Competitive Moat Notes", "business-builder", "business_owner", [
    ...sharedFields,
    field("strengths", "Operational strengths", "textarea", true, "What is hard to copy?")
  ]),
  template("launch_plan", "Launch Plan Builder", "business-builder", "business_owner", [
    ...sharedFields,
    field("launch_date", "Launch date", "text", false, "Target date or launch window")
  ]),
  template("mvp_validation", "MVP Validation Plan", "business-builder", "business_owner", [
    ...sharedFields,
    field("assumption", "Assumption to test", "textarea", true, "What needs evidence?")
  ]),
  template("cold_outreach", "Cold Outreach Draft", "growth-studio", "growth_operator", [
    ...sharedFields,
    field("permission_context", "Permission context", "textarea", true, "Why is outreach allowed?")
  ]),
  template("ad_copy", "Ad Copy Draft", "growth-studio", "growth_operator", [
    ...sharedFields,
    field("channel", "Ad channel", "select", true, "Choose placement", [
      "search",
      "social",
      "local",
      "email"
    ])
  ]),
  template("sales_pitch", "Sales Pitch Outline", "business-builder", "business_owner", [
    ...sharedFields,
    field("buyer_objection", "Common objection", "textarea", false, "What might stop the buyer?")
  ]),
  template("customer_response", "Customer Response Draft", "support", "support", [
    field("customer_message", "Customer message", "textarea", true, "Paste the customer request"),
    field("policy_context", "Policy context", "textarea", false, "Relevant approved policy")
  ]),
  template("report_summary", "Report Summary", "admin-command-center", "admin", [
    field("report_notes", "Report notes", "textarea", true, "Paste non-secret notes"),
    field("decision_needed", "Decision needed", "textarea", false, "What should the owner decide?")
  ]),
  template("meeting_action_plan", "Meeting Action Plan", "admin-command-center", "admin", [
    field("meeting_notes", "Meeting notes", "textarea", true, "Paste notes without secrets"),
    field("owner_priorities", "Owner priorities", "textarea", false, "Known priorities")
  ]),
  template("seo_blog_outline", "SEO Blog Outline", "growth-studio", "growth_operator", [
    ...sharedFields,
    field("keyword", "Search topic", "text", true, "Topic or keyword cluster")
  ]),
  template("faq_builder", "FAQ Builder", "support", "support", [
    ...sharedFields,
    field("questions", "Known questions", "textarea", true, "List real customer questions")
  ]),
  template("linkedin_caption", "LinkedIn Caption Draft", "creator-studio", "content_creator", [
    ...sharedFields,
    field("tone", "Tone", "select", true, "Pick a style", ["plain", "teaching", "launch"])
  ]),
  template(
    "website_copy_improvement",
    "Website Copy Improvement",
    "business-builder",
    "business_owner",
    [
      field("current_copy", "Current copy", "textarea", true, "Paste current copy"),
      field("goal", "Goal", "textarea", true, "What needs to be clearer?")
    ]
  ),
  template("job_description", "Job Description Draft", "business-builder", "business_owner", [
    field("role", "Role", "text", true, "Job title"),
    field("responsibilities", "Responsibilities", "textarea", true, "Core work"),
    field("requirements", "Requirements", "textarea", true, "Required skills")
  ]),
  template("professional_email", "Professional Email Draft", "business-builder", "business_owner", [
    field("recipient_context", "Recipient context", "textarea", true, "Who receives it?"),
    field("message_goal", "Message goal", "textarea", true, "What should happen next?")
  ]),
  template(
    "customer_feedback_analysis",
    "Customer Feedback Analysis",
    "growth-studio",
    "growth_operator",
    [
      field("feedback", "Feedback", "textarea", true, "Paste feedback with private data removed"),
      field("business_context", "Business context", "textarea", true, "What is the product?")
    ]
  ),
  template("content_calendar", "Content Calendar Planner", "creator-studio", "content_creator", [
    ...sharedFields,
    field("cadence", "Cadence", "select", true, "Publishing rhythm", [
      "weekly",
      "twice_weekly",
      "monthly"
    ])
  ]),
  template(
    "business_tool_comparison",
    "Business Tool Comparison",
    "business-builder",
    "business_owner",
    [
      field("tools", "Tools", "textarea", true, "Tools being compared"),
      field("criteria", "Criteria", "textarea", true, "Budget, team, workflow, risk")
    ]
  ),
  template("team_meeting_agenda", "Team Meeting Agenda", "admin-command-center", "admin", [
    field("meeting_goal", "Meeting goal", "textarea", true, "What should the team decide?"),
    field("updates", "Updates", "textarea", false, "Known updates")
  ]),
  template("creator_release_plan", "Creator Release Plan", "creator-studio", "content_creator", [
    field("asset", "Asset", "text", true, "Release asset or project"),
    field("rights_status", "Rights status", "textarea", true, "Rights and licensing notes"),
    field("launch_goal", "Launch goal", "textarea", true, "What should release accomplish?")
  ]),
  template("campaign_strategy", "Campaign Strategy Draft", "growth-studio", "growth_operator", [
    ...sharedFields,
    field("budget_context", "Budget context", "text", false, "Optional budget range")
  ]),
  template("review_response", "Review Response Draft", "support", "support", [
    field("review_text", "Review text", "textarea", true, "Paste the real review"),
    field("desired_outcome", "Desired outcome", "textarea", true, "What should the response do?")
  ]),
  template("referral_campaign", "Referral Campaign Draft", "growth-studio", "growth_operator", [
    ...sharedFields,
    field("reward", "Referral reward", "text", false, "Approved incentive if any")
  ]),
  template("support_reply", "Support Reply Draft", "support", "support", [
    field("support_issue", "Support issue", "textarea", true, "What happened?"),
    field("approved_resolution", "Approved resolution", "textarea", false, "Known resolution")
  ]),
  template("admin_report", "Admin Report Brief", "admin-command-center", "admin", [
    field("system_notes", "System notes", "textarea", true, "Non-secret system notes"),
    field("risk_notes", "Risk notes", "textarea", false, "Known risks")
  ]),
  template("security_summary", "Security Summary Brief", "security-center", "admin", [
    field("finding", "Finding", "textarea", true, "Finding without secrets"),
    field("impact", "Impact", "textarea", true, "Potential impact")
  ]),
  template(
    "reliability_incident_summary",
    "Reliability Incident Summary",
    "reliability-center",
    "admin",
    [
      field("incident", "Incident", "textarea", true, "What degraded?"),
      field("timeline", "Timeline", "textarea", true, "Known timeline")
    ]
  ),
  template("owner_daily_review", "Owner Daily Review", "admin-command-center", "owner", [
    field(
      "pending_items",
      "Pending items",
      "textarea",
      true,
      "Approvals, support, billing, security"
    ),
    field("top_risks", "Top risks", "textarea", false, "Known launch or ops risks")
  ])
]);

export function getPromptTemplates(): readonly PromptTemplate[] {
  return promptTemplateRegistry;
}

export function getPromptTemplateById(templateId: string): PromptTemplate | undefined {
  return promptTemplateRegistry.find((template) => template.id === templateId);
}

export function getPromptTemplatesByProductArea(
  productArea: PromptProductArea
): readonly PromptTemplate[] {
  return promptTemplateRegistry.filter((template) => template.product_area === productArea);
}

export function searchPromptTemplates(query: string): readonly PromptTemplate[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return promptTemplateRegistry;
  }
  return promptTemplateRegistry.filter((template) =>
    [template.id, template.name, template.product_area, template.category, template.prompt_goal]
      .join(" ")
      .toLowerCase()
      .includes(normalized)
  );
}

function template(
  category: PromptCategory,
  name: string,
  productArea: PromptProductArea,
  targetUser: PromptTargetUser,
  inputFields: readonly PromptInputField[]
): PromptTemplate {
  const risky = isApprovalCategory(category, productArea);
  const riskLevel = risky ? "high" : productArea === "security-center" ? "medium" : "low";
  return Object.freeze({
    id: `${category}_v1`,
    name,
    product_area: productArea,
    category,
    target_user: targetUser,
    input_fields: Object.freeze([...inputFields]),
    prompt_goal: createPromptGoal(category, productArea),
    output_format: createOutputFormat(category),
    safety_notes: Object.freeze(createSafetyNotes(category, productArea)),
    approval_required: risky,
    risk_level: riskLevel,
    example_output_placeholder:
      "Example output appears here after the user supplies context. Keep it draft-only until reviewed.",
    created_at: now,
    updated_at: now
  });
}

function field(
  id: string,
  label: string,
  type: PromptInputField["type"],
  required: boolean,
  placeholder: string,
  options?: readonly string[]
): PromptInputField {
  return Object.freeze({ id, label, type, required, placeholder, options });
}

function isApprovalCategory(category: PromptCategory, productArea: PromptProductArea): boolean {
  return (
    (
      [
        "cold_outreach",
        "ad_copy",
        "customer_response",
        "review_response",
        "referral_campaign",
        "campaign_strategy",
        "professional_email",
        "support_reply"
      ] as readonly PromptCategory[]
    ).includes(category) || productArea === "legal-readiness"
  );
}

function createPromptGoal(category: PromptCategory, productArea: PromptProductArea): string {
  return `Create an original, structured ${category.replaceAll("_", " ")} draft for ${productArea.replaceAll(
    "-",
    " "
  )} using only user-provided facts.`;
}

function createOutputFormat(category: PromptCategory): string {
  return [
    `Title: ${category.replaceAll("_", " ")}`,
    "Context summary",
    "Draft output",
    "Assumptions to verify",
    "Owner review needed, if applicable",
    "Next manual action"
  ].join("\n");
}

function createSafetyNotes(
  category: PromptCategory,
  productArea: PromptProductArea
): readonly string[] {
  const notes = [
    "Use original wording only.",
    "Use only real user-provided facts.",
    "Do not present drafts as professional legal, tax, financial, or security advice.",
    "Keep public-facing or customer-facing outputs draft-only until approved."
  ];
  if (category.includes("review")) {
    notes.push("Use only genuine customer feedback and approved proof records.");
  }
  if (productArea === "creator-studio") {
    notes.push("Respect rights, licensing, consent, and provenance records.");
  }
  return Object.freeze(notes);
}
