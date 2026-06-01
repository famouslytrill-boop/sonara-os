import type { DeploymentSyncContext, SupabaseSyncStatus } from "./types.ts";
import { isEnvConfigured } from "./env-validator.ts";
import { makeFinding, summarizeStatus } from "./sync-utils.ts";

export function checkSupabaseSync(context: DeploymentSyncContext = {}): SupabaseSyncStatus {
  const env = context.env ?? {};
  const files = context.repoFiles ?? new Set<string>();
  const findings = [
    makeFinding(
      "supabase",
      isEnvConfigured(env, "NEXT_PUBLIC_SUPABASE_URL") ? "configured" : "not_configured",
      "medium",
      "supabase.url",
      "Supabase project URL must be configured for database-backed app features."
    ),
    makeFinding(
      "supabase",
      isEnvConfigured(env, "NEXT_PUBLIC_SUPABASE_ANON_KEY") ? "configured" : "not_configured",
      "medium",
      "supabase.anon_key",
      "Supabase anon key may be public but must match the intended project."
    ),
    makeFinding(
      "supabase",
      isEnvConfigured(env, "SUPABASE_SERVICE_ROLE_KEY") ? "configured" : "not_configured",
      "high",
      "supabase.service_role",
      "Service role key must be server-only and never appear in client bundles."
    ),
    makeFinding(
      "supabase",
      files.has("supabase/migrations/0001_auth_organization_scaffold.sql")
        ? "configured"
        : "needs_review",
      "medium",
      "supabase.migrations",
      "Database migrations and RLS policy docs must be reviewed before enabling writes."
    ),
    makeFinding(
      "supabase",
      "needs_review",
      "high",
      "supabase.auth_redirects",
      "Auth redirect URLs must include sonaraindustries.com and local development URLs in Supabase."
    )
  ];
  return Object.freeze({
    provider: "supabase",
    ...summarizeStatus(findings),
    findings: Object.freeze(findings),
    metadata: Object.freeze({ organizationIsolationRequired: true })
  });
}
