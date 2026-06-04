export type OAuthProviderRecord = Readonly<{
  id: "google";
  label: string;
  status: "provider_setup_required";
  featureFlag: "NEXT_PUBLIC_AUTH_GOOGLE_ENABLED";
  requiredRedirectRoute: string;
  notes: string;
}>;

export const oauthProviderRegistry: readonly OAuthProviderRecord[] = Object.freeze([
  Object.freeze({
    id: "google",
    label: "Google",
    status: "provider_setup_required",
    featureFlag: "NEXT_PUBLIC_AUTH_GOOGLE_ENABLED",
    requiredRedirectRoute: "/auth/callback",
    notes:
      "Google OAuth requires Supabase provider setup, OAuth client credentials, and production redirect URL verification."
  })
]);
