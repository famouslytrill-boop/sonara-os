import type { PromptApprovalStatus, PromptSafetyFinding, PromptSafetyInput } from "./types.ts";

const blockedPromptRules = Object.freeze([
  rule("legal_advice_final", /(?:final|binding|guaranteed)\s+legal\s+advice/i),
  rule("tax_advice_final", /(?:final|binding|guaranteed)\s+tax\s+advice/i),
  rule("financial_advice_final", /(?:investment|financial)\s+advice\s+(?:guarantee|as final)/i),
  rule("fake_reviews", /(?:write|generate|invent|create)\s+(?:fake\s+)?(?:reviews|testimonials)/i),
  rule("deceptive_marketing", /(?:deceive|mislead|trick)\s+(?:customers|buyers|users)/i),
  rule("fake_scarcity", /(?:fake|false)\s+(?:scarcity|urgency)/i),
  rule(
    "impersonation",
    /(?:impersonate|pretend to be)\s+(?:a customer|an employee|a celebrity|a real person)/i
  ),
  rule("private_scraping", /scrape\s+(?:private|logged-in|protected|paywalled)/i),
  rule("spam_outreach", /(?:spam|blast)\s+(?:people|customers|leads|emails|sms)/i),
  rule("customer_manipulation", /manipulate\s+(?:customers|buyers|users)/i),
  rule(
    "sensitive_personal_data",
    /collect\s+(?:ssn|social security|medical|health|religion|race)/i
  ),
  rule("platform_bypass", /bypass\s+(?:platform|provider|site)\s+rules/i),
  rule(
    "credential_handling",
    /(?:collect|store|handle)\s+(?:passwords|api keys|credentials|tokens|secrets)/i
  ),
  rule(
    "publish_without_approval",
    /publish\s+(?:ai|generated|draft)\s+output\s+without\s+(?:owner\s+)?approval/i
  )
]);

const ownerReviewCategories: readonly string[] = Object.freeze([
  "cold_outreach",
  "ad_copy",
  "customer_response",
  "professional_email",
  "review_response",
  "referral_campaign",
  "support_reply",
  "campaign_strategy"
]);

export function evaluatePromptSafety(input: PromptSafetyInput): PromptSafetyFinding {
  const reasons: string[] = [];
  const blockedTerms = blockedPromptRules
    .filter((blockedRule) => blockedRule.pattern.test(input.text))
    .map((blockedRule) => blockedRule.key);

  let approvalStatus: PromptApprovalStatus = "not_required";
  let status: PromptSafetyFinding["status"] = "allowed";
  let riskLevel = input.risk_level;

  if (blockedTerms.length > 0) {
    status = "blocked";
    approvalStatus = "blocked";
    riskLevel = "critical";
    reasons.push("Prompt request matches blocked safety policy.");
  }

  if (
    status !== "blocked" &&
    (input.public_facing ||
      input.customer_facing ||
      input.risk_level === "high" ||
      input.risk_level === "critical" ||
      ownerReviewCategories.includes(input.category))
  ) {
    status = "owner_review_required";
    approvalStatus = "owner_review_required";
    reasons.push("Public, customer-facing, or high-risk prompt outputs require owner approval.");
  }

  if (reasons.length === 0) {
    reasons.push("Prompt is draft-only and uses original, user-provided context.");
  }

  return Object.freeze({
    status,
    approval_status: approvalStatus,
    risk_level: riskLevel,
    reasons: Object.freeze(reasons),
    blocked_terms: Object.freeze(blockedTerms)
  });
}

export function getBlockedPromptRuleKeys(): readonly string[] {
  return blockedPromptRules.map((blockedRule) => blockedRule.key);
}

function rule(key: string, pattern: RegExp) {
  return Object.freeze({ key, pattern });
}
