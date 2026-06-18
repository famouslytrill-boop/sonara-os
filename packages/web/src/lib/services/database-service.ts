export type ServiceReadiness = Readonly<{
  service: string;
  provider: "supabase" | "stripe" | "static_shell";
  status: "ready_for_adapter" | "requires_env" | "future_flagged";
  notes: readonly string[];
  secretsExposed: false;
}>;

export function createServiceReadiness(
  service: string,
  provider: ServiceReadiness["provider"],
  status: ServiceReadiness["status"],
  notes: readonly string[]
): ServiceReadiness {
  return Object.freeze({
    service,
    provider,
    status,
    notes: Object.freeze([...notes]),
    secretsExposed: false
  });
}

export function createDatabaseServiceReadiness(): ServiceReadiness {
  return createServiceReadiness("database", "supabase", "requires_env", [
    "Supabase remains the source of truth.",
    "RLS and organization membership checks must protect private records.",
    "Local caches are drafts only."
  ]);
}
