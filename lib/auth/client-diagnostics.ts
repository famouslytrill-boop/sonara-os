import { getSupabasePublicConfig } from "../supabase";

export function getAuthDiagnostics() {
  const config = getSupabasePublicConfig();

  return {
    supabasePublicConfigured: Boolean(config),
    message: config
      ? "Supabase public auth configuration is present."
      : "Supabase Auth is missing public configuration. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel, then redeploy.",
  };
}

export function formatPublicAuthError(error: unknown) {
  if (error instanceof Error) {
    if (/failed to fetch|networkerror|load failed/i.test(error.message)) {
      return "Auth request could not reach Supabase. Verify NEXT_PUBLIC_SUPABASE_URL, browser network access, Supabase URL configuration, and Vercel production env scope.";
    }

    return error.message;
  }

  return "Auth request failed. Check Supabase provider setup and browser network logs.";
}
