import { createSupabaseAuthConfigDiagnostic } from "../env.ts";
import { authRedirectRoutes } from "./auth-redirects.ts";
import { oauthProviderRegistry } from "./oauth-provider-registry.ts";
import { passwordPolicy } from "./password-policy.ts";

export type AuthReadinessSnapshot = Readonly<{
  supabasePublicUrl: ReturnType<typeof createSupabaseAuthConfigDiagnostic>;
  supabaseAnonKeyConfigured: boolean;
  googleOAuthReady: boolean;
  magicLinkReady: boolean;
  passwordResetReady: boolean;
  requiredSetup: readonly string[];
}>;

export function createAuthReadinessSnapshot(
  env: Partial<Record<string, string | undefined>> = getRuntimeEnv()
): AuthReadinessSnapshot {
  const supabasePublicUrl = createSupabaseAuthConfigDiagnostic({
    appName: "SONARA Industries",
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    enableSound: true,
    enableVideo: true,
    enableMic: true
  });
  const supabaseAnonKeyConfigured = Boolean(env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());
  const redirectDocsReady = authRedirectRoutes.every((route) => route.required);
  const googleOAuthReady = oauthProviderRegistry.some((provider) => provider.id === "google");
  const magicLinkReady =
    supabasePublicUrl.browserAuthReady && supabaseAnonKeyConfigured && redirectDocsReady;
  const passwordResetReady = magicLinkReady && passwordPolicy.minimumLength >= 12;
  return Object.freeze({
    supabasePublicUrl,
    supabaseAnonKeyConfigured,
    googleOAuthReady,
    magicLinkReady,
    passwordResetReady,
    requiredSetup: Object.freeze([
      "Set NEXT_PUBLIC_SUPABASE_URL to the Supabase Project Settings API Project URL.",
      "Set NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel and local .env.local.",
      "Configure Supabase Auth redirect URLs for /auth/callback and /reset-password.",
      "Enable Google OAuth in Supabase before using the Google button.",
      "Verify email templates, password reset, magic links, RLS, and owner bootstrap."
    ])
  });
}

function getRuntimeEnv(): Partial<Record<string, string | undefined>> {
  return (
    (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } })
      .process?.env ?? {}
  );
}
