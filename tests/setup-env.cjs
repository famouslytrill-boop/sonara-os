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
  "GOOGLE_",
  "OPENCLAW_",
  "N8N_",
  "OLLAMA_",
  "LANGFLOW_",
  "DIFY_",
  "OPEN_WEBUI_",
  "RAGFLOW_",
  "CREWAI_",
  "SONARA_AI_INTEGRATION_"
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

// Tests use project.supabase.co as an intentionally fake configured-provider
// host. Keep that placeholder entirely offline so a leaked temporary env value
// cannot create a real socket, delay public pages, or keep Mocha alive after the
// assertions finish. Tests that need provider behavior replace global.fetch
// with a scoped mock and restore this firewall afterward.
const nativeFetch = global.fetch;
if (typeof nativeFetch === "function") {
  global.fetch = async (input, init) => {
    const address = String(input?.url || input || "");
    if (/^https:\/\/project\.supabase\.co(?:\/|$)/i.test(address)) {
      return {
        ok: false,
        status: 503,
        headers: { get: () => null },
        json: async () => [],
        text: async () => JSON.stringify({ ok: false, code: "test_provider_blocked" })
      };
    }
    return nativeFetch(input, init);
  };
}
