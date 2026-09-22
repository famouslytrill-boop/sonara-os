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

// Supertest creates and closes a fresh loopback listener for every request
// when it receives an Express function. The full suite makes thousands of
// those requests; on Windows the closed connections remain in TIME_WAIT long
// enough to exhaust the dynamic port range during a repeated or instrumented
// run. Reuse one test-owned listener per app function and close those listeners
// after the suite. This changes only the test transport lifecycle, not the
// Express application or any production networking behavior.
const supertestPath = require.resolve("supertest");
const supertest = require(supertestPath);
const sharedServerByApp = new WeakMap();
const sharedServers = new Set();

function sharedServer(app) {
  let server = sharedServerByApp.get(app);
  if (!server) {
    server = require("node:http").createServer(app);
    sharedServerByApp.set(app, server);
    sharedServers.add(server);
  }
  return server;
}

const request = (app, options) => supertest(
  typeof app === "function" ? sharedServer(app) : app,
  options
);
Object.assign(request, supertest);
request.agent = (app, options) => supertest.agent(
  typeof app === "function" ? sharedServer(app) : app,
  options
);

// The first request starts the cached server through Supertest. Prevent its
// normal per-request close so later requests can reuse it.
const originalEnd = supertest.Test.prototype.end;
supertest.Test.prototype.end = function end(fn) {
  if (sharedServers.has(this.app) && this._server === this.app) this._server = null;
  return originalEnd.call(this, fn);
};

if (typeof after === "function") {
  after("close shared test HTTP listeners", async () => {
    await Promise.all([...sharedServers].map((server) => new Promise((resolve) => {
      if (!server.listening) return resolve();
      server.close(() => resolve());
    })));
  });
}

require.cache[supertestPath].exports = request;

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
