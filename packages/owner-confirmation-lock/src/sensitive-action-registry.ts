import type {
  ActionRiskLevel,
  OwnerApprovalRequirement,
  OwnerConfirmationCategory,
  SensitiveActionRegistryEntry
} from "./types.ts";

export const ownerConfirmationCategories = Object.freeze([
  "money_movement",
  "refunds",
  "price_changes",
  "payout_settings",
  "legal_policy_text",
  "customer_facing_campaigns",
  "security_setting_changes",
  "deleting_data",
  "publishing_proof_reviews",
  "ai_voice_output",
  "ai_visual_output",
  "ai_video_output"
] satisfies readonly OwnerConfirmationCategory[]);

export const alwaysBlockedActionKeys = Object.freeze([
  "change_payout_destination",
  "remove_owner",
  "disable_security_gates",
  "delete_audit_logs",
  "send_legal_notice",
  "send_deceptive_claims",
  "publish_fake_reviews_proof"
] satisfies readonly string[]);

export const sensitiveActionRegistry: readonly SensitiveActionRegistryEntry[] = Object.freeze([
  createRegistryEntry({
    category: "money_movement",
    title: "Money movement",
    riskLevel: "critical",
    summary:
      "Moving funds, initiating payouts, payment transfer logic, and marketplace payout paths require owner confirmation.",
    rules: [
      "The app must not move funds automatically.",
      "Marketplace payouts require future Stripe Connect review.",
      "Payout destination changes are never routine automation."
    ],
    integrations: ["Billing/Stripe", "Business Builder", "Security Center"]
  }),
  createRegistryEntry({
    category: "refunds",
    title: "Refunds",
    riskLevel: "high",
    summary: "Refunds require owner confirmation before action.",
    rules: [
      "Automation may draft refund notes.",
      "Automation may flag possible refund requests.",
      "Automation may not issue refunds directly."
    ],
    integrations: ["Billing/Stripe", "Business Builder"]
  }),
  createRegistryEntry({
    category: "price_changes",
    title: "Price changes",
    riskLevel: "high",
    summary: "Pricing, discounts, coupons, and offer pricing require owner confirmation.",
    rules: [
      "Automation may suggest price changes.",
      "Automation may not publish price changes.",
      "Live pricing changes require owner confirmation."
    ],
    integrations: ["Pricing", "Business Builder", "Creator Studio", "Growth Studio"]
  }),
  createRegistryEntry({
    category: "payout_settings",
    title: "Payout settings",
    riskLevel: "critical",
    summary: "Payout account, bank, provider, and schedule settings require owner confirmation.",
    rules: [
      "Changing payout destination is always blocked from routine automation.",
      "Payout setting changes create critical audit events.",
      "Payout details must be redacted in approval previews."
    ],
    integrations: ["Billing/Stripe", "Security Center"]
  }),
  createRegistryEntry({
    category: "legal_policy_text",
    title: "Legal and policy text",
    riskLevel: "high",
    summary:
      "Terms, privacy, refund policies, disclaimers, and legal-readiness output are draft-only until approved.",
    rules: [
      "AI may draft legal or policy text only as draft content.",
      "No legal advice claims.",
      "Publishing requires owner confirmation."
    ],
    integrations: ["Legal Readiness", "Business Builder", "Creator Studio", "Growth Studio"]
  }),
  createRegistryEntry({
    category: "customer_facing_campaigns",
    title: "Customer-facing campaigns",
    riskLevel: "high",
    summary:
      "Customer emails, SMS, review requests, win-back messages, and public announcements require owner confirmation.",
    rules: [
      "Respect opt-out and communication permission status.",
      "Automation may draft and schedule suggestions.",
      "Automation may not send without owner approval."
    ],
    integrations: ["Business Builder", "Creator Studio", "Growth Studio"]
  }),
  createRegistryEntry({
    category: "security_setting_changes",
    title: "Security setting changes",
    riskLevel: "critical",
    summary:
      "Role, owner lock, provider key, AI provider, RLS, MFA, domain, webhook, and admin access changes require owner confirmation.",
    rules: [
      "Deleting audit logs is always blocked.",
      "Disabling security gates is blocked from routine automation.",
      "Critical financial/security changes require owner role."
    ],
    integrations: ["Security Center", "Reliability Center", "Admin"]
  }),
  createRegistryEntry({
    category: "deleting_data",
    title: "Deleting data",
    riskLevel: "critical",
    summary:
      "Customer, organization, file, billing, legal, proof, asset, and audit records are destructive surfaces.",
    rules: [
      "Soft delete should be preferred.",
      "Destructive actions must show a warning.",
      "Audit log deletion is always blocked."
    ],
    integrations: ["Business Builder", "Creator Studio", "Security Center"]
  }),
  createRegistryEntry({
    category: "publishing_proof_reviews",
    title: "Publishing proof and reviews",
    riskLevel: "high",
    summary:
      "Proof profiles, proof cards, badges, testimonials, review highlights, and verification claims require owner confirmation.",
    rules: [
      "The system must not publish fake reviews.",
      "Trust badges must use actual verified records.",
      "Customer proof requires permission."
    ],
    integrations: ["Business Builder", "Creator Studio", "Growth Studio"]
  }),
  createRegistryEntry({
    category: "ai_voice_output",
    title: "AI voice outputs",
    riskLevel: "critical",
    summary: "Public or commercial AI voice output requires owner confirmation and disclosure.",
    rules: [
      "Voice cloning remains disabled unless consent exists.",
      "No public figure, celebrity, employee, customer, or third-party impersonation.",
      "Synthetic voice disclosure is required."
    ],
    integrations: ["Creator Studio", "Security Center"]
  }),
  createRegistryEntry({
    category: "ai_visual_output",
    title: "AI visual outputs",
    riskLevel: "high",
    summary:
      "Commercial visuals, proof visuals, trust badges, graphics, and campaign visuals require owner confirmation.",
    rules: [
      "No fake IDs, certifications, legal, medical, or financial proof.",
      "No fake reviews or deceptive deepfakes.",
      "Asset-rights check is required before approval."
    ],
    integrations: ["Creator Studio", "Growth Studio", "Security Center"]
  }),
  createRegistryEntry({
    category: "ai_video_output",
    title: "AI video outputs",
    riskLevel: "critical",
    summary: "Public or commercial AI video output requires owner confirmation and draft labeling.",
    rules: [
      "No deceptive video proof.",
      "No fake endorsements or public figure impersonation.",
      "No sensitive/private video processing by default."
    ],
    integrations: ["Creator Studio", "Growth Studio", "Security Center"]
  })
]);

export function isOwnerConfirmationCategory(
  category: string | undefined
): category is OwnerConfirmationCategory {
  return ownerConfirmationCategories.includes(category as OwnerConfirmationCategory);
}

export function getSensitiveActionRegistryEntry(
  category: string | undefined
): SensitiveActionRegistryEntry | null {
  if (!isOwnerConfirmationCategory(category)) {
    return null;
  }
  return sensitiveActionRegistry.find((entry) => entry.category === category) ?? null;
}

export function isAlwaysBlockedActionKey(actionKey: string): boolean {
  return alwaysBlockedActionKeys.includes(actionKey);
}

function createRegistryEntry({
  category,
  title,
  riskLevel,
  summary,
  rules,
  integrations,
  approvalRequirement = "owner_review_required"
}: {
  category: OwnerConfirmationCategory;
  title: string;
  riskLevel: ActionRiskLevel;
  summary: string;
  rules: readonly string[];
  integrations: readonly string[];
  approvalRequirement?: OwnerApprovalRequirement;
}): SensitiveActionRegistryEntry {
  return Object.freeze({
    category,
    title,
    riskLevel,
    approvalRequirement,
    summary,
    rules: Object.freeze([...rules]),
    integrations: Object.freeze([...integrations])
  });
}
