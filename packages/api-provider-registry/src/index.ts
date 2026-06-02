export type ApiProviderStatus = "approved_reference" | "needs_terms_review" | "blocked";
export type ApiProviderRisk = "low" | "medium" | "high" | "critical";

export type ApiProviderRecord = Readonly<{
  providerId: string;
  label: string;
  category:
    | "payments"
    | "auth"
    | "database"
    | "maps"
    | "messaging"
    | "scraping"
    | "support"
    | "developer"
    | "ai"
    | "security"
    | "email"
    | "alerting"
    | "vector_database"
    | "communications"
    | "video"
    | "database_reference";
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
  ]),
  provider("github", "GitHub", "developer", "needs_terms_review", "high", [
    "Tokens must stay server-side.",
    "Repository metadata sync must respect rate limits.",
    "Do not auto-install, copy, or merge third-party repositories."
  ]),
  provider("openjarvis_reference", "OpenJarvis reference", "ai", "needs_terms_review", "high", [
    "Reference only; no automatic shell access.",
    "Private file access requires explicit consent and audit logs."
  ]),
  provider("skillopt_reference", "SkillOpt reference", "ai", "needs_terms_review", "medium", [
    "Reference only; no hidden production prompt changes.",
    "Prompt or skill changes require validation and audit logging."
  ]),
  provider("longlive_reference", "LongLive reference", "ai", "needs_terms_review", "high", [
    "Research only; no bundled model weights without license review.",
    "No production video generation claims until provider, hardware, and rights review pass."
  ]),
  provider("pentestagent_reference", "PentestAgent reference", "security", "blocked", "critical", [
    "No public pentest automation.",
    "Authorized defensive security reference only."
  ]),
  provider(
    "nasa_worldview_reference",
    "NASA Worldview reference",
    "maps",
    "needs_terms_review",
    "high",
    [
      "No NASA endorsement or partnership claims.",
      "No surveillance, people tracking, or emergency routing claims."
    ]
  ),
  provider(
    "foundation_emails_reference",
    "Foundation Emails reference",
    "email",
    "needs_terms_review",
    "medium",
    [
      "Reference only; no outbound provider is configured by this record.",
      "Email templates require accessibility, deliverability, and license review."
    ]
  ),
  provider(
    "mail2telegram_reference",
    "mail2telegram reference",
    "alerting",
    "needs_terms_review",
    "high",
    [
      "Internal alert adapter review only.",
      "Do not forward customer data, support messages, tokens, or secrets to chat channels."
    ]
  ),
  provider(
    "qdrant_reference",
    "Qdrant reference",
    "vector_database",
    "needs_terms_review",
    "medium",
    [
      "Reference only until privacy, deletion, cost, and operations review pass.",
      "Vector indexes must inherit source document permissions."
    ]
  ),
  provider(
    "milvus_reference",
    "Milvus reference",
    "vector_database",
    "needs_terms_review",
    "medium",
    ["Future enterprise candidate only.", "No production sync without privacy and cost review."]
  ),
  provider(
    "surrealdb_reference",
    "SurrealDB reference",
    "database_reference",
    "needs_terms_review",
    "high",
    [
      "Research only; Supabase remains the source of truth.",
      "Source-available/BSL terms require legal review."
    ]
  ),
  provider(
    "cockroachdb_reference",
    "CockroachDB reference",
    "database_reference",
    "needs_terms_review",
    "high",
    [
      "Future scale reference only; Supabase remains the source of truth.",
      "License, cost, and migration review required."
    ]
  ),
  provider(
    "tdengine_reference",
    "TDengine reference",
    "database_reference",
    "blocked",
    "critical",
    [
      "AGPL-3.0 risk; restricted reference only.",
      "Do not bundle or integrate into closed-source product without legal review."
    ]
  ),
  provider(
    "xiaomi_kernel_reference",
    "Xiaomi Kernel Open Source",
    "security",
    "blocked",
    "critical",
    ["Blocked from product integration.", "Do not copy kernel source or use as an app dependency."]
  ),
  provider(
    "linphone_iphone_reference",
    "Linphone iPhone reference",
    "communications",
    "blocked",
    "critical",
    [
      "GPL-3.0/proprietary dual-license risk.",
      "Reference only; no SIP credentials client-side, robocalling, covert recording, or emergency calling claims."
    ]
  ),
  provider(
    "hyperframes_reference",
    "HyperFrames reference",
    "video",
    "needs_terms_review",
    "high",
    [
      "Reference only; no production rendering without queues, quotas, storage, auth, and rights review.",
      "No HeyGen partnership claims, fake endorsements, non-consensual likeness, or unlimited rendering."
    ]
  )
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
