export const databaseProviderPolicy = Object.freeze({
  sourceOfTruth: "Supabase Postgres",
  arbitraryUserDatabasesAllowed: false,
  localCachesAreSourceOfTruth: false,
  rules: Object.freeze([
    "Cloud Postgres/Supabase remains the source of truth.",
    "Business Builder uses metadata-driven tenant-scoped schemas, not arbitrary physical databases.",
    "External database technologies are review-only until migration, cost, RLS, and operational risk are approved."
  ])
});
