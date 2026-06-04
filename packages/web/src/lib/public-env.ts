export type PublicAuthEnvSnapshot = Readonly<{
  siteUrl?: string;
  appUrl?: string;
  vercelUrl?: string;
  supabaseUrl?: string;
  supabaseAnonKeyConfigured: boolean;
  googleEnabled: boolean;
  phoneEnabled: boolean;
}>;

declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;

export function readPublicAuthEnv(
  env: Partial<Record<string, string | undefined>> = getRuntimeEnv()
): PublicAuthEnvSnapshot {
  return Object.freeze({
    siteUrl: normalizeEnvValue(env.NEXT_PUBLIC_SITE_URL),
    appUrl: normalizeEnvValue(env.NEXT_PUBLIC_APP_URL),
    vercelUrl: normalizeEnvValue(env.NEXT_PUBLIC_VERCEL_URL ?? env.VERCEL_URL),
    supabaseUrl: normalizeEnvValue(env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseAnonKeyConfigured: Boolean(env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()),
    googleEnabled: env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED === "true",
    phoneEnabled: env.NEXT_PUBLIC_AUTH_PHONE_ENABLED === "true"
  });
}

export function getPublicAuthEnvRequirements() {
  return Object.freeze([
    "NEXT_PUBLIC_SITE_URL",
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_AUTH_GOOGLE_ENABLED",
    "NEXT_PUBLIC_AUTH_PHONE_ENABLED"
  ]);
}

function normalizeEnvValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function getRuntimeEnv(): Partial<Record<string, string | undefined>> {
  return typeof process === "undefined" ? {} : (process.env ?? {});
}
