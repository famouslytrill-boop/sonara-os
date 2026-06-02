export type SupabaseEnvStatus = "configured" | "missing" | "server_only";

export type SupabaseEnvRequirement = Readonly<{
  name: string;
  publicSafe: boolean;
  requiredFor: string;
  status: SupabaseEnvStatus;
}>;

declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;

export const supabaseEnvRequirements = Object.freeze([
  requirement("NEXT_PUBLIC_SUPABASE_URL", true, "browser auth client and deployment metadata"),
  requirement("NEXT_PUBLIC_SUPABASE_ANON_KEY", true, "browser auth client"),
  requirement("SUPABASE_SERVICE_ROLE_KEY", false, "server-only admin tasks and storage writes"),
  requirement("SUPABASE_ACCESS_TOKEN", false, "Supabase Preview and CLI automation"),
  requirement("SUPABASE_PROJECT_ID", false, "Supabase Preview project target"),
  requirement("SUPABASE_DB_PASSWORD", false, "Supabase Preview migration execution")
]);

export function createSupabaseEnvironmentReport() {
  return Object.freeze(
    supabaseEnvRequirements.map((item) =>
      Object.freeze({
        ...item,
        status: readEnv(item.name) ? ("configured" as const) : item.status
      })
    )
  );
}

function requirement(
  name: string,
  publicSafe: boolean,
  requiredFor: string
): SupabaseEnvRequirement {
  return Object.freeze({
    name,
    publicSafe,
    requiredFor,
    status: publicSafe ? "missing" : "server_only"
  });
}

function readEnv(name: string): string | undefined {
  return typeof process === "undefined" ? undefined : process.env?.[name];
}
