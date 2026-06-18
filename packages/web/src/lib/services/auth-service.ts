import { createServiceReadiness } from "./database-service.ts";

export function createAuthServiceReadiness() {
  return createServiceReadiness("auth", "supabase", "requires_env", [
    "Browser auth uses NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    "Service-role keys stay server-only.",
    "Private app access requires active organization membership."
  ]);
}
