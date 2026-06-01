export type ApiProviderStatus = "approved_reference" | "needs_terms_review" | "blocked";
export type ApiProviderRisk = "low" | "medium" | "high" | "critical";

export type ApiProviderRecord = Readonly<{
  providerId: string;
  label: string;
  category: "payments" | "auth" | "database" | "maps" | "messaging" | "scraping" | "support";
  status: ApiProviderStatus;
  risk: ApiProviderRisk;
  frontendSecretsAllowed: false;
  rules: readonly string[];
}>;

export const apiProviderRegistry: readonly ApiProviderRecord[] = Object.freeze([
  provider("stripe", "Stripe", "payments", "needs_terms_review", "high", [
    "Secret key server-side only.",
    "Webhook signatures required.",
    "Owner confirmation required for refunds, price changes, and payout settings."
  ]),
  provider("supabase", "Supabase", "database", "needs_terms_review", "high", [
    "Service role key server-side only.",
    "RLS must protect organization-scoped records."
  ]),
  provider(
    "official_whatsapp_business_api",
    "Official WhatsApp Business API",
    "messaging",
    "needs_terms_review",
    "high",
    [
      "Use approved providers only.",
      "Customer consent and owner approval are required before sends."
    ]
  ),
  provider(
    "unofficial_whatsapp_automation",
    "Unofficial WhatsApp automation",
    "messaging",
    "blocked",
    "critical",
    ["Blocked for production.", "Use official APIs or approved providers only."]
  ),
  provider("direct_google_scraping", "Direct Google scraping", "scraping", "blocked", "critical", [
    "Blocked for production.",
    "Use official APIs, OpenStreetMap, public datasets, or customer-provided data."
  ])
]);

export function evaluateApiProvider(providerId: string): ApiProviderRecord {
  return (
    apiProviderRegistry.find((providerRecord) => providerRecord.providerId === providerId) ??
    provider("unknown_provider", "Unknown provider", "support", "needs_terms_review", "high", [
      "Unknown providers default to terms and security review."
    ])
  );
}

export function getBlockedApiProviders(): readonly ApiProviderRecord[] {
  return apiProviderRegistry.filter((providerRecord) => providerRecord.status === "blocked");
}

function provider(
  providerId: string,
  label: string,
  category: ApiProviderRecord["category"],
  status: ApiProviderStatus,
  risk: ApiProviderRisk,
  rules: readonly string[]
): ApiProviderRecord {
  return Object.freeze({
    providerId,
    label,
    category,
    status,
    risk,
    frontendSecretsAllowed: false,
    rules: Object.freeze([...rules])
  });
}
