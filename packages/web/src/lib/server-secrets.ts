declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;

export type ServerSecretAudit = Readonly<{
  serviceRoleConfigured: boolean;
  publicLeakDetected: boolean;
  message: string;
}>;

export function isBrowserRuntime(): boolean {
  return typeof window !== "undefined";
}

export function getServerSecret(name: "SUPABASE_SERVICE_ROLE_KEY"): string | undefined {
  if (isBrowserRuntime()) {
    return undefined;
  }
  return typeof process === "undefined" ? undefined : process.env?.[name];
}

export function auditServerSecrets(
  env: Record<string, string | undefined> | undefined = typeof process === "undefined"
    ? undefined
    : process.env
): ServerSecretAudit {
  const serviceRoleConfigured = Boolean(env?.SUPABASE_SERVICE_ROLE_KEY);
  const publicLeakDetected = Boolean(env?.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY);
  return Object.freeze({
    serviceRoleConfigured,
    publicLeakDetected,
    message: publicLeakDetected
      ? "Service-role secret must never use a public environment prefix."
      : "Service-role secret remains server-only."
  });
}
