import { getSupabasePublicConfigDiagnostic, supabasePublicUrlMisconfiguredMessage } from "../supabase";

export function getAuthDiagnostics() {
  const diagnostic = getSupabasePublicConfigDiagnostic();

  return {
    supabasePublicConfigured: diagnostic.ok,
    reason: diagnostic.reason,
    message: diagnostic.message,
  };
}

export function formatPublicAuthError(error: unknown, context: "google" | "phone" | "email" | "password" = "email") {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";

  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return supabasePublicUrlMisconfiguredMessage;
  }

  if (/unsupported provider|provider.*not.*enabled|provider.*disabled/i.test(message)) {
    if (context === "google") {
      return "Google sign-in is not enabled in Supabase yet. Enable Google in Supabase Auth Providers and add the callback URL.";
    }

    if (context === "phone") {
      return "Phone sign-in is not enabled in Supabase yet. Enable Phone Auth and an SMS provider in Supabase before using OTP login.";
    }
  }

  if (/fetch/i.test(message) && /supabase/i.test(message)) {
    return supabasePublicUrlMisconfiguredMessage;
  }

  if (message && !/^\s*[{[]/.test(message)) {
    return message;
  }

  return "Auth request failed. Check Supabase provider setup and browser network logs.";
}
