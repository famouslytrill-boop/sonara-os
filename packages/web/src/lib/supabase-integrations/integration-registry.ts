export type SupabaseIntegrationCategory =
  | "auth"
  | "preview"
  | "edge_functions"
  | "queues"
  | "cron"
  | "webhooks"
  | "storage"
  | "realtime"
  | "vector_search"
  | "vault"
  | "wrappers"
  | "provider_health";

export type SupabaseIntegrationRecord = Readonly<{
  id: string;
  label: string;
  category: SupabaseIntegrationCategory;
  status: "documented" | "planned" | "requires_secret" | "blocked";
  storesSecrets: false;
  rules: readonly string[];
}>;

export const supabaseIntegrationRegistry: readonly SupabaseIntegrationRecord[] = Object.freeze([
  integration("auth_mfa_admin_security", "Auth, MFA, and admin security", "auth", "documented", [
    "Admin unlock requires active organization membership.",
    "Owner bootstrap remains a human-reviewed production step."
  ]),
  integration("branching_preview", "Supabase Branching and Preview", "preview", "requires_secret", [
    "Preview runs only when GitHub Actions secrets exist.",
    "Migration errors must fail the check when credentials are configured."
  ]),
  integration("edge_functions", "Edge Functions", "edge_functions", "planned", [
    "No production function deployment without reviewed secrets and audit logging."
  ]),
  integration("queues", "Queues", "queues", "planned", [
    "Use queues for heavy imports, video rendering, email fanout, and document extraction."
  ]),
  integration("cron", "Cron", "cron", "planned", [
    "Scheduled jobs must be visible, bounded, and owner-approved."
  ]),
  integration("database_webhooks", "Database Webhooks", "webhooks", "planned", [
    "Webhook signatures and retry/audit policy are required before production use."
  ]),
  integration("storage_buckets", "Storage buckets", "storage", "documented", [
    "Private by default.",
    "Public files require explicit publish approval."
  ]),
  integration("realtime_dashboards", "Realtime dashboards", "realtime", "planned", [
    "Realtime channels must not expose private tenant data across organizations."
  ]),
  integration("vector_search", "Vector search and AI", "vector_search", "planned", [
    "Derived chunks must inherit source document privacy and deletion policy."
  ]),
  integration("vault", "Vault and secret references", "vault", "planned", [
    "Never store secret values in app tables; store references only."
  ]),
  integration("wrappers", "Foreign Data Wrappers", "wrappers", "planned", [
    "Third-party data wrappers require terms, security, and privacy review."
  ]),
  integration("provider_health", "Provider health checks", "provider_health", "planned", [
    "Health checks must redact tokens, customer data, and provider payloads."
  ])
]);

function integration(
  id: string,
  label: string,
  category: SupabaseIntegrationCategory,
  status: SupabaseIntegrationRecord["status"],
  rules: readonly string[]
): SupabaseIntegrationRecord {
  return Object.freeze({
    id,
    label,
    category,
    status,
    storesSecrets: false,
    rules: Object.freeze([...rules])
  });
}
