export const launchDatabaseTables = Object.freeze([
  "organizations",
  "organization_members",
  "user_profiles",
  "audit_logs",
  "customer_records",
  "proof_profiles",
  "payment_options",
  "booking_links",
  "smart_intake_forms",
  "offers",
  "reviews"
]);

export const databaseLaunchPolicy = Object.freeze({
  rlsReadyRequired: true,
  organizationScopedBusinessTables: true,
  serviceRoleServerOnly: true,
  setupModeWhenSupabaseMissing: true
});

export function createDatabaseHealthPlaceholder() {
  return Object.freeze({
    status: "needs_review",
    message: "Database connection must be verified in the deployed environment."
  });
}
