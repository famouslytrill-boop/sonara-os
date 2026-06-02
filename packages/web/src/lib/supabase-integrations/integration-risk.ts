import type { SupabaseIntegrationRecord } from "./integration-registry.ts";

export function requiresSupabaseIntegrationReview(record: SupabaseIntegrationRecord): boolean {
  return record.status === "planned" || record.status === "requires_secret";
}

export function assertNoSupabaseIntegrationSecrets(record: SupabaseIntegrationRecord) {
  if (record.storesSecrets) {
    throw new Error(`${record.id} must store secret references only, not secret values.`);
  }
}
