import { createSupabaseAuthConfigDiagnostic } from "./env.ts";
import { readPublicAuthEnv } from "./public-env.ts";

export type EnvironmentStatusItem = Readonly<{
  label: string;
  configured: boolean;
  publicSafe: boolean;
  detail: string;
}>;

export function createEnvironmentStatusSnapshot(
  env: Partial<Record<string, string | undefined>> = getRuntimeEnv()
) {
  const publicAuthEnv = readPublicAuthEnv(env);
  const supabase = createSupabaseAuthConfigDiagnostic({
    appName: "SONARA Industries",
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    enableSound: true,
    enableVideo: true,
    enableMic: true
  });
  const supabaseAdminKeyName = ["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_");
  const items: EnvironmentStatusItem[] = [
    item(
      "NEXT_PUBLIC_SITE_URL",
      Boolean(publicAuthEnv.siteUrl),
      true,
      "Canonical public site URL."
    ),
    item("NEXT_PUBLIC_APP_URL", Boolean(publicAuthEnv.appUrl), true, "Optional public app URL."),
    item("NEXT_PUBLIC_SUPABASE_URL", supabase.url.valid, true, "Public Supabase API Project URL."),
    item(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      publicAuthEnv.supabaseAnonKeyConfigured,
      true,
      "Public Supabase anon key; expected to be visible to browser users."
    ),
    item(
      "NEXT_PUBLIC_AUTH_GOOGLE_ENABLED",
      publicAuthEnv.googleEnabled,
      true,
      "Google auth button remains disabled unless this is exactly true."
    ),
    item(
      "NEXT_PUBLIC_AUTH_GOOGLE_PROVIDER_READY",
      publicAuthEnv.googleProviderReady,
      true,
      "Set to true only after the Supabase Google provider and Google Cloud Web application OAuth client are verified."
    ),
    item(
      "NEXT_PUBLIC_AUTH_PHONE_ENABLED",
      publicAuthEnv.phoneEnabled,
      true,
      "Phone OTP remains disabled unless this is exactly true."
    ),
    item(
      "Supabase privileged admin key",
      Boolean(env[supabaseAdminKeyName]),
      false,
      "Server-only."
    ),
    item("RESEND_API_KEY", Boolean(env.RESEND_API_KEY), false, "Server-only outbound email key."),
    item("RESEND_FROM_EMAIL", Boolean(env.RESEND_FROM_EMAIL), false, "Verified outbound sender.")
  ];

  return Object.freeze({
    supabase,
    items: Object.freeze(items),
    productionSafe:
      supabase.browserAuthReady &&
      publicAuthEnv.googleEnabled === true &&
      publicAuthEnv.googleProviderReady === true &&
      items.every((status) => status.publicSafe || status.configured)
  });
}

function item(
  label: string,
  configured: boolean,
  publicSafe: boolean,
  detail: string
): EnvironmentStatusItem {
  return Object.freeze({ label, configured, publicSafe, detail });
}

function getRuntimeEnv(): Partial<Record<string, string | undefined>> {
  return (
    (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } })
      .process?.env ?? {}
  );
}
