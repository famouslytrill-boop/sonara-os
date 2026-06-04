export type AuthErrorCode =
  | "provider_not_enabled"
  | "validation_failed"
  | "invalid_redirect"
  | "missing_env"
  | "exchange_failed"
  | "unknown_error";

export const authErrorMessages: Readonly<Record<AuthErrorCode, string>> = Object.freeze({
  provider_not_enabled:
    "Google sign-in is not enabled yet. Use email/password or email link, or finish Supabase Google provider setup.",
  validation_failed: "Authentication could not be validated. Try again from the login page.",
  invalid_redirect: "The requested redirect was not allowed. Return to the app and try again.",
  missing_env: "Supabase public URL is misconfigured. Check NEXT_PUBLIC_SUPABASE_URL in Vercel.",
  exchange_failed: "Authentication could not be completed. Return to login and try again.",
  unknown_error: "Authentication could not be completed. Return to login and try again."
});

export function normalizeAuthErrorCode(value: string | null | undefined): AuthErrorCode {
  if (
    value === "provider_not_enabled" ||
    value === "validation_failed" ||
    value === "invalid_redirect" ||
    value === "missing_env" ||
    value === "exchange_failed"
  ) {
    return value;
  }
  return "unknown_error";
}

export function normalizeProviderErrorCode(message: string | undefined): AuthErrorCode {
  if (!message) {
    return "unknown_error";
  }
  if (/unsupported provider|provider.*not enabled|provider_not_enabled/i.test(message)) {
    return "provider_not_enabled";
  }
  if (/redirect/i.test(message)) {
    return "invalid_redirect";
  }
  return "unknown_error";
}
