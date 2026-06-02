export const supabaseAuthLaunchPolicy = Object.freeze({
  publicKeysAllowed: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
  serverOnlyKeys: [
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_ACCESS_TOKEN",
    "SUPABASE_PROJECT_ID",
    "SUPABASE_DB_PASSWORD"
  ],
  redirectReviewRequired: true,
  ownerBootstrapRequired: true,
  rules: Object.freeze([
    "Logged-out users must see sign-in or setup gates, not private app records.",
    "Users without active organization membership must see owner bootstrap guidance.",
    "Admin routes require owner/admin membership before data is shown.",
    "Service-role keys are never exposed to client bundles or public route renderers."
  ])
});
