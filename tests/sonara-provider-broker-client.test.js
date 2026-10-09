"use strict";

const assert = require("node:assert/strict");
const {
  BROKER_FUNCTION,
  MAX_REQUEST_BYTES,
  brokerContext,
  brokerRequestSignature,
  responseContainsSecretKey,
  invokeGoogleSearchConsoleBroker,
  getProviderBrokerClientContract
} = require("../lib/sonara-provider-broker-client.cjs");

const ORG = "11111111-1111-4111-8111-111111111111";
const BUSINESS = "22222222-2222-4222-8222-222222222222";
const USER = "33333333-3333-4333-8333-333333333333";
const CONNECTION = "44444444-4444-4444-8444-444444444444";
const SERVICE = "legacy-service-role-test-value";
const SECRET_API = "sb_secret_provider_broker_test_value";
const BROKER = "dedicated-provider-broker-token-that-is-long-enough";
const CONTEXT = Object.freeze({
  organizationId: ORG,
  businessId: BUSINESS,
  userId: USER,
  connectionId: CONNECTION
});

function response(status, body, headers = {}) {
  const normalized = Object.fromEntries(Object.entries(headers).map(([k, v]) => [String(k).toLowerCase(), String(v)]));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => normalized[String(name).toLowerCase()] || null },
    text: async () => typeof body === "string" ? body : JSON.stringify(body)
  };
}

function configured(overrides = {}) {
  return {
    getSupabaseServerConfig: () => ({
      ok: true,
      url: "https://project-ref.supabase.co",
      secretKey: SECRET_API,
      serviceRoleKey: SERVICE
    }),
    getBrokerToken: () => BROKER,
    nowImpl: () => Date.parse("2026-10-08T21:30:00.000Z"),
    ...overrides
  };
}

describe("server-only provider broker client", () => {
  it("requires exact UUID tenant context", () => {
    assert.deepEqual({ ...brokerContext(CONTEXT) }, CONTEXT);
    assert.throws(
      () => brokerContext({ ...CONTEXT, organizationId: "another-tenant" }),
      /organizationId/
    );
  });

  it("calls only the fixed Edge Function with a server API key plus a body-bound HMAC signature", async () => {
    let call = null;
    const out = await invokeGoogleSearchConsoleBroker({
      operation: "read_daily",
      context: CONTEXT,
      payload: { date: "2026-10-07" },
      ...configured({
        fetchImpl: async (url, options) => {
          call = { url, options };
          return response(200, {
            ok: true,
            operation: "read_daily",
            report: { provider: "google_search_console", rowCount: 0 }
          });
        }
      })
    });
    assert.equal(out.ok, true);
    assert.equal(out.brokerFunction, BROKER_FUNCTION);
    assert.equal(out.providerSecretsReturned, false);
    assert.equal(call.url, "https://project-ref.supabase.co/functions/v1/google-search-console-broker");
    assert.equal(call.options.method, "POST");
    assert.equal(call.options.redirect, "error");
    assert.equal(call.options.headers.authorization, undefined);
    assert.equal(call.options.headers.apikey, SECRET_API);
    assert.equal(call.options.headers["x-sonara-provider-broker-token"], undefined);
    assert.equal(call.options.headers["x-sonara-provider-broker-timestamp"], "1791495000");
    assert.equal(
      call.options.headers["x-sonara-provider-broker-signature"],
      brokerRequestSignature({
        timestamp: "1791495000",
        body: call.options.body,
        brokerToken: BROKER
      })
    );
    const body = JSON.parse(call.options.body);
    assert.equal(body.operation, "read_daily");
    assert.deepEqual(body.context, CONTEXT);
    assert.equal(body.payload.date, "2026-10-07");
  });

  it("binds the HMAC to timestamp, method, fixed path and exact request body", () => {
    const first = brokerRequestSignature({
      timestamp: "1791495000",
      body: '{"a":1}',
      brokerToken: BROKER
    });
    const second = brokerRequestSignature({
      timestamp: "1791495001",
      body: '{"a":1}',
      brokerToken: BROKER
    });
    const third = brokerRequestSignature({
      timestamp: "1791495000",
      body: '{"a":2}',
      brokerToken: BROKER
    });
    assert.match(first, /^v1=[A-Za-z0-9_-]{43}$/);
    assert.notEqual(first, second);
    assert.notEqual(first, third);
    assert.equal(first.includes(BROKER), false);
  });

  it("refuses arbitrary operations before network access", async () => {
    let calls = 0;
    await assert.rejects(
      async () => invokeGoogleSearchConsoleBroker({
        operation: "run_any_sql",
        context: CONTEXT,
        payload: {},
        ...configured({ fetchImpl: async () => { calls += 1; return response(200, {}); } })
      }),
      /operation must be one of/
    );
    assert.equal(calls, 0);
  });

  it("refuses raw secret-shaped request fields", async () => {
    let calls = 0;
    await assert.rejects(
      async () => invokeGoogleSearchConsoleBroker({
        operation: "complete_authorization",
        context: CONTEXT,
        payload: { refresh_token: "must-never-cross-this-boundary" },
        ...configured({ fetchImpl: async () => { calls += 1; return response(200, {}); } })
      }),
      /raw secret material/
    );
    assert.equal(calls, 0);
  });

  it("allows OAuth authorization codes and PKCE verifiers because they are one-time protocol material, not stored provider credentials", async () => {
    let body = null;
    const out = await invokeGoogleSearchConsoleBroker({
      operation: "complete_authorization",
      context: CONTEXT,
      payload: {
        code: "one-time-code",
        verifier: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        redirectUri: "https://sonaraindustries.com/oauth/google-search-console/callback"
      },
      ...configured({
        fetchImpl: async (_url, options) => {
          body = JSON.parse(options.body);
          return response(200, { ok: true, operation: "complete_authorization", sites: [] });
        }
      })
    });
    assert.equal(out.ok, true);
    assert.equal(body.payload.code, "one-time-code");
    assert.equal(body.payload.verifier.length, 43);
  });

  it("refuses the legacy service-role key for this new broker component", async () => {
    let calls = 0;
    const out = await invokeGoogleSearchConsoleBroker({
      operation: "review_sites",
      context: CONTEXT,
      payload: {},
      getSupabaseServerConfig: () => ({
        ok: true,
        url: "https://project-ref.supabase.co",
        serviceRoleKey: SERVICE
      }),
      getBrokerToken: () => BROKER,
      nowImpl: () => Date.parse("2026-10-08T21:30:00.000Z"),
      fetchImpl: async () => {
        calls += 1;
        return response(200, { ok: true });
      }
    });
    assert.equal(out.ok, false);
    assert.equal(out.code, "provider_broker_supabase_not_configured");
    assert.equal(calls, 0);
  });

  it("fails closed when Supabase or the dedicated broker token is unavailable", async () => {
    let out = await invokeGoogleSearchConsoleBroker({
      operation: "read_daily",
      context: CONTEXT,
      payload: {},
      getSupabaseServerConfig: () => ({ ok: false })
    });
    assert.equal(out.code, "provider_broker_supabase_not_configured");

    out = await invokeGoogleSearchConsoleBroker({
      operation: "read_daily",
      context: CONTEXT,
      payload: {},
      getSupabaseServerConfig: () => ({
        ok: true,
        url: "https://project-ref.supabase.co",
        secretKey: SECRET_API,
        serviceRoleKey: SERVICE
      }),
      getBrokerToken: () => "short"
    });
    assert.equal(out.code, "provider_broker_token_not_configured");
  });

  it("refuses non-origin or insecure Supabase URLs", async () => {
    for (const url of [
      "http://project-ref.supabase.co",
      "https://user:pass@project-ref.supabase.co",
      "https://project-ref.supabase.co/rest/v1",
      "https://project-ref.supabase.co/?x=1"
    ]) {
      const out = await invokeGoogleSearchConsoleBroker({
        operation: "read_daily",
        context: CONTEXT,
        payload: {},
        ...configured({
          getSupabaseServerConfig: () => ({ ok: true, url, secretKey: SECRET_API, serviceRoleKey: SERVICE })
        })
      });
      assert.equal(out.ok, false, url);
      assert.equal(out.code, "provider_broker_supabase_url_invalid", url);
    }
  });

  it("rejects any secret-shaped response rather than accidentally forwarding it", async () => {
    for (const body of [
      { ok: true, access_token: "leak" },
      { ok: true, nested: { refreshToken: "leak" } },
      { ok: true, nested: [{ client_secret: "leak" }] }
    ]) {
      const out = await invokeGoogleSearchConsoleBroker({
        operation: "read_daily",
        context: CONTEXT,
        payload: {},
        ...configured({ fetchImpl: async () => response(200, body) })
      });
      assert.equal(out.ok, false);
      assert.equal(out.code, "provider_broker_secret_leak_detected");
    }
    assert.equal(responseContainsSecretKey({ report: { rowCount: 0 } }), false);
  });

  it("does not automatically retry an authorization code exchange or disconnect", async () => {
    for (const operation of ["complete_authorization", "disconnect"]) {
      let calls = 0;
      const out = await invokeGoogleSearchConsoleBroker({
        operation,
        context: CONTEXT,
        payload: {},
        ...configured({
          fetchImpl: async () => {
            calls += 1;
            throw new Error("ambiguous network failure");
          }
        })
      });
      assert.equal(out.ok, false);
      assert.equal(out.code, "provider_broker_network_error");
      assert.equal(out.retryMode, "none");
      assert.equal(calls, 1);
    }
  });

  it("marks read-only provider failures for durable retry without sleeping in the request", async () => {
    for (const operation of ["review_sites", "read_daily"]) {
      let calls = 0;
      const out = await invokeGoogleSearchConsoleBroker({
        operation,
        context: CONTEXT,
        payload: {},
        ...configured({
          fetchImpl: async () => {
            calls += 1;
            throw new Error("network down");
          }
        })
      });
      assert.equal(out.ok, false, operation);
      assert.equal(out.retryMode, "durable_deferred", operation);
      assert.equal(out.retryAfterSeconds, 60, operation);
      assert.equal(calls, 1, operation);
    }
  });

  it("preserves bounded deferred retry metadata from the broker", async () => {
    const out = await invokeGoogleSearchConsoleBroker({
      operation: "read_daily",
      context: CONTEXT,
      payload: {},
      ...configured({
        fetchImpl: async () => response(429, {
          ok: false,
          code: "provider_rate_limited",
          retryMode: "durable_deferred",
          retryAfterSeconds: 120
        })
      })
    });
    assert.equal(out.ok, false);
    assert.equal(out.code, "provider_rate_limited");
    assert.equal(out.retryMode, "durable_deferred");
    assert.equal(out.retryAfterSeconds, 120);
  });

  it("rejects oversized requests before network access", async () => {
    let calls = 0;
    const out = await invokeGoogleSearchConsoleBroker({
      operation: "read_daily",
      context: CONTEXT,
      payload: { padding: "x".repeat(MAX_REQUEST_BYTES) },
      ...configured({ fetchImpl: async () => { calls += 1; return response(200, {}); } })
    });
    assert.equal(out.ok, false);
    assert.equal(out.code, "provider_broker_request_too_large");
    assert.equal(calls, 0);
  });

  it("describes the browser-disabled, non-retrying authority boundary", () => {
    const contract = getProviderBrokerClientContract();
    assert.equal(contract.transport, "supabase_edge_function");
    assert.equal(contract.auth.browserCallable, false);
    assert.equal(contract.auth.apiKey, "supabase_secret_key_required");
    assert.equal(contract.auth.platformJwtVerification, false);
    assert.equal(contract.auth.requestHmac, "v1");
    assert.equal(contract.auth.sharedSecretTransmitted, false);
    assert.equal(contract.auth.maximumClockSkewSeconds, 120);
    assert.equal(contract.retries.complete_authorization, "never_automatic");
    assert.equal(contract.retries.review_sites, "safe_to_retry_after_deferred_failure");
    assert.equal(contract.retries.disconnect, "never_automatic");
    assert.equal(contract.rawProviderSecretInputAllowed, false);
    assert.equal(contract.productionEnabled, false);
  });
});
