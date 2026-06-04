export const ownerBootstrapSteps = Object.freeze([
  "Sign up as the first user in the production Supabase auth project.",
  "Copy the auth user ID from Supabase Auth.",
  "Create a row in public.organizations.",
  "Create an active public.organization_members row for the owner user.",
  "Set the membership role to owner.",
  "Log out and back in, then verify /app/admin unlocks."
]);

export const ownerBootstrapPolicy = Object.freeze({
  publicOwnerCreationEndpoint: "blocked",
  serviceRoleClientExposure: "blocked",
  manualSupabaseOperationRequired: true,
  auditRequiredBeforeAutomatedBootstrap: true
});
