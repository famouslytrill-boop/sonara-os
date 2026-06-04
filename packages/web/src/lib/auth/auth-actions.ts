import { createSupabaseAuthConfigDiagnostic } from "../env.ts";
import { readPublicAuthEnv } from "../public-env.ts";
import { getAuthCallbackUrl } from "./get-site-url.ts";

export type AuthActionStatus = "ready" | "disabled";

export type AuthProviderAction = Readonly<{
  provider: "google";
  status: AuthActionStatus;
  redirectTo: string;
  message: string;
}>;

export function createGoogleOAuthAction(
  env: Partial<Record<string, string | undefined>> = getRuntimeEnv()
): AuthProviderAction {
  const publicEnv = readPublicAuthEnv(env);
  const diagnostic = createSupabaseAuthConfigDiagnostic({
    appName: "SONARA Industries",
    siteUrl: env.NEXT_PUBLIC_SITE_URL,
    appUrl: env.NEXT_PUBLIC_APP_URL,
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    authGoogleEnabled: publicEnv.googleEnabled,
    authPhoneEnabled: publicEnv.phoneEnabled,
    enableSound: true,
    enableVideo: true,
    enableMic: true
  });
  const redirectTo = getAuthCallbackUrl(env, "/app");
  if (!diagnostic.browserAuthReady) {
    return disabled(redirectTo, diagnostic.message);
  }
  if (!publicEnv.googleEnabled) {
    return disabled(
      redirectTo,
      "Google sign-in is not enabled yet. Use email/password or email link, or finish Supabase Google provider setup."
    );
  }
  return Object.freeze({
    provider: "google",
    status: "ready",
    redirectTo,
    message:
      "Google sign-in is feature-flag enabled. Supabase must still have the Google provider enabled before production testing."
  });
}

export function createPhoneOtpAction(
  env: Partial<Record<string, string | undefined>> = getRuntimeEnv()
) {
  const publicEnv = readPublicAuthEnv(env);
  return Object.freeze({
    status: publicEnv.phoneEnabled ? ("ready" as const) : ("disabled" as const),
    message: publicEnv.phoneEnabled
      ? "Phone OTP is feature-flag enabled. Confirm Supabase phone auth before production testing."
      : "Phone OTP is not enabled yet. Use email/password or email link until phone auth setup is complete."
  });
}

function disabled(redirectTo: string, message: string): AuthProviderAction {
  return Object.freeze({
    provider: "google",
    status: "disabled",
    redirectTo,
    message
  });
}

function getRuntimeEnv(): Partial<Record<string, string | undefined>> {
  return (
    (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } })
      .process?.env ?? {}
  );
}
