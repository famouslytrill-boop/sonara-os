// Deterministic test environment for the SONARA OS suite.
//
// Vercel injects production environment variables into the build process. The
// test suite must never inherit live provider credentials or readiness state,
// otherwise unit tests can contact production services and configuration tests
// become dependent on the deployment environment.
//
// Individual tests that exercise configured providers set explicit temporary
// values and restore them afterward.

process.env.NODE_ENV = "test";

const isolatedProviderPrefixes = [
  "SUPABASE_",
  "NEXT_PUBLIC_SUPABASE_",
  "STRIPE_",
  "RESEND_",
  "GOOGLE_"
];

const isolatedProviderKeys = new Set([
  "ADMIN_EMAIL",
  "ADMIN_EMAILS",
  "SUPPORT_TO_EMAIL",
  "CONTACT_TO_EMAIL"
]);

for (const key of Object.keys(process.env)) {
  if (isolatedProviderKeys.has(key) || isolatedProviderPrefixes.some((prefix) => key.startsWith(prefix))) {
    delete process.env[key];
  }
}
