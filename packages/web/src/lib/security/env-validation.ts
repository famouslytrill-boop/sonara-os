export type SecurityEnvIssueSeverity = "warning" | "blocked";

export type SecurityEnvIssue = Readonly<{
  id: string;
  severity: SecurityEnvIssueSeverity;
  message: string;
}>;

export type SecurityEnvValidationResult = Readonly<{
  ok: boolean;
  issues: readonly SecurityEnvIssue[];
}>;

const dangerousPublicNameParts = Object.freeze([
  "SECRET",
  "SERVICE_ROLE",
  "PRIVATE",
  "WEBHOOK",
  "TOKEN",
  "PASSWORD",
  "STRIPE_SECRET",
  "DATABASE_URL"
]);

declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;

export function validateSecurityEnv(
  env: Record<string, string | undefined> = typeof process === "undefined"
    ? {}
    : (process.env ?? {})
): SecurityEnvValidationResult {
  const issues: SecurityEnvIssue[] = [];
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if ((supabaseUrl && !supabaseAnonKey) || (!supabaseUrl && supabaseAnonKey)) {
    issues.push({
      id: "incomplete-public-supabase-config",
      severity: "warning",
      message: "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set together."
    });
  }

  for (const key of Object.keys(env)) {
    if (!key.startsWith("NEXT_PUBLIC_")) {
      continue;
    }
    if (dangerousPublicNameParts.some((part) => key.includes(part))) {
      issues.push({
        id: "dangerous-public-env-name",
        severity: "blocked",
        message: `${key} uses a browser-exposed prefix for a sensitive value name.`
      });
    }
  }

  return Object.freeze({
    ok: issues.every((issue) => issue.severity !== "blocked"),
    issues: Object.freeze(issues)
  });
}

export function hasPublicSecretExposure(env: Record<string, string | undefined>): boolean {
  return validateSecurityEnv(env).issues.some((issue) => issue.severity === "blocked");
}
