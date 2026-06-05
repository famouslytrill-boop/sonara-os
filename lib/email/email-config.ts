import "server-only";

export type SupportEmailCategory =
  | "contact"
  | "support"
  | "help"
  | "billing"
  | "security"
  | "privacy"
  | "legal"
  | "feedback";

type EmailEnvName =
  | "CONTACT_EMAIL"
  | "SUPPORT_EMAIL"
  | "HELP_EMAIL"
  | "BILLING_EMAIL"
  | "SECURITY_EMAIL"
  | "PRIVACY_EMAIL"
  | "LEGAL_EMAIL";

const categoryRecipientEnv: Record<SupportEmailCategory, EmailEnvName> = {
  contact: "CONTACT_EMAIL",
  support: "SUPPORT_EMAIL",
  help: "HELP_EMAIL",
  billing: "BILLING_EMAIL",
  security: "SECURITY_EMAIL",
  privacy: "PRIVACY_EMAIL",
  legal: "LEGAL_EMAIL",
  feedback: "SUPPORT_EMAIL",
};

export function getEmailEnvValue(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function mapContactCategoryToEmailCategory(category: string): SupportEmailCategory {
  if (category === "billing_refund" || category === "sales_pricing") return "billing";
  if (category === "technical_support") return "support";
  if (category === "security_report") return "security";
  if (category === "legal_privacy") return "privacy";
  return "contact";
}

export function resolveSupportEmailRecipient(category: SupportEmailCategory) {
  const primary = getEmailEnvValue(categoryRecipientEnv[category]);
  const fallback = getEmailEnvValue("SUPPORT_EMAIL") ?? getEmailEnvValue("CONTACT_EMAIL");
  return primary ?? fallback;
}

export function getResendEmailConfig(category: SupportEmailCategory) {
  const apiKey = getEmailEnvValue("RESEND_API_KEY");
  const from = getEmailEnvValue("RESEND_FROM_EMAIL");
  const to = resolveSupportEmailRecipient(category);

  if (!apiKey || !from || !to) return null;

  return {
    apiKey,
    from,
    to,
  };
}

export function getSupportEmailReadiness(category: SupportEmailCategory = "support") {
  const hasProvider = Boolean(getEmailEnvValue("RESEND_API_KEY"));
  const hasSender = Boolean(getEmailEnvValue("RESEND_FROM_EMAIL"));
  const hasRecipient = Boolean(resolveSupportEmailRecipient(category));

  return {
    configured: hasProvider && hasSender && hasRecipient,
    hasProvider,
    hasRecipient,
    hasSender,
    provider: hasProvider ? "resend" : "none",
  };
}
