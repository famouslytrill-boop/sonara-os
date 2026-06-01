export type SupabaseAdminReadiness = Readonly<{
  urlConfigured: boolean;
  serviceRoleConfigured: boolean;
  usableServerSide: boolean;
}>;

declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;

export function getSupabaseAdminReadiness(): SupabaseAdminReadiness {
  const urlConfigured = Boolean(readEnv("NEXT_PUBLIC_SUPABASE_URL"));
  const serviceRoleConfigured = Boolean(readEnv("SUPABASE_SERVICE_ROLE_KEY"));
  return Object.freeze({
    urlConfigured,
    serviceRoleConfigured,
    usableServerSide: urlConfigured && serviceRoleConfigured && isServerRuntime()
  });
}

export function assertServerOnlySupabaseAdminUse() {
  if (!isServerRuntime()) {
    throw new Error("Supabase admin access is server-only and cannot run in browser code.");
  }
}

function isServerRuntime(): boolean {
  return typeof window === "undefined";
}

function readEnv(name: string): string | undefined {
  return typeof process === "undefined" ? undefined : process.env?.[name];
}
