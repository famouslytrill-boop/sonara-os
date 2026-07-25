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

// Keep unmocked Supabase traffic offline. Tests that intentionally exercise a
// configured provider replace global.fetch with a scoped mock; the runtime can
// identify this tagged default firewall and fail closed before creating a
// request. Restoring the original fetch restores the firewall after each test.
const nativeFetch = global.fetch;
if (typeof nativeFetch === "function") {
  const offlineProviderFetch = async (input, init) => {
    const address = String(input?.url || input || "");
    if (/^https:\/\/[a-z0-9-]+\.supabase\.co(?:\/|$)/i.test(address)) {
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
  Object.defineProperty(offlineProviderFetch, "__sonaraOfflineFirewall", {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false
  });
  global.fetch = offlineProviderFetch;
}
