"use strict";

const assert = require("node:assert/strict");
const {
  READONLY_SCOPE,
  GOOGLE_AUTHORIZATION_ENDPOINT,
  GOOGLE_TOKEN_ENDPOINT,
  GOOGLE_WRITE_SCOPE,
  GOOGLE_REVOKE_ENDPOINT,
  createGoogleSearchConsoleAuthorization,
  completeGoogleSearchConsoleAuthorization,
  runGoogleSearchConsoleDailySync,
  revokeGoogleSearchConsoleAuthorization
} = require("../lib/sonara-google-search-console-read.cjs");

const ORG = "11111111-1111-4111-8111-111111111111";
const BUSINESS = "22222222-2222-4222-8222-222222222222";
const USER = "33333333-3333-4333-8333-333333333333";
const CONNECTION = "44444444-4444-4444-8444-444444444444";
const SECRET = "provider-oauth-state-secret-that-is-deliberately-long-enough";
const REDIRECT = "https://sonaraindustries.com/oauth/google-search-console/callback";
const CLIENT_ID = "client-id.apps.googleusercontent.com";
const CLIENT_SECRET = "google-client-secret-server-only";
const NOW = "2026-10-08T21:00:00.000Z";

function deterministicRandom(bytes) {
  return Buffer.alloc(bytes, bytes === 32 ? 11 : 13);
}

function response(status, payload, headers = {}) {
  const normalized = Object.fromEntries(Object.entries(headers).map(([k,v]) => [String(k).toLowerCase(), String(v)]));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => normalized[String(name).toLowerCase()] || null },
    text: async () => JSON.stringify(payload)
  };
}

function start(overrides = {}) {
  return createGoogleSearchConsoleAuthorization({
    organizationId: ORG,
    businessId: BUSINESS,
    userId: USER,
    connectionId: CONNECTION,
    redirectUri: REDIRECT,
    clientId: CLIENT_ID,
    stateSecret: SECRET,
    now: NOW,
    randomBytesImpl: deterministicRandom,
    ...overrides
  });
}

function completionInput(tx, overrides = {}) {
  return {
    state: tx.transaction.state,
    cookieValue: tx.transaction.cookieValue,
    stateSecret: SECRET,
    now: "2026-10-08T21:05:00.000Z",
    organizationId: ORG,
    businessId: BUSINESS,
    userId: USER,
    connectionId: CONNECTION,
    redirectUri: REDIRECT,
    code: "authorization-code-once",
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    ...overrides
  };
}

describe("Google Search Console customer-owned OAuth lifecycle", () => {
  it("builds read-only offline authorization with PKCE and no mutation scope", () => {
    const out = start();
    assert.equal(out.ok, true);
    assert.equal(out.runtimeAuthorityGranted, false);
    const url = new URL(out.authorizationUrl);
    assert.equal(url.origin + url.pathname, GOOGLE_AUTHORIZATION_ENDPOINT);
    assert.equal(url.searchParams.get("response_type"), "code");
    assert.equal(url.searchParams.get("scope"), READONLY_SCOPE);
    assert.equal(url.searchParams.get("access_type"), "offline");
    assert.equal(url.searchParams.has("include_granted_scopes"), false);
    assert.equal(url.searchParams.has("prompt"), false);
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    assert.notEqual(url.searchParams.get("state"), "");
    assert.equal(url.searchParams.get("scope").includes(GOOGLE_WRITE_SCOPE), false);
  });

  it("requests consent only when the caller explicitly needs a fresh refresh grant", () => {
    assert.equal(new URL(start({ forceConsent: true }).authorizationUrl).searchParams.get("prompt"), "consent");
    assert.equal(new URL(start({ forceConsent: false }).authorizationUrl).searchParams.has("prompt"), false);
  });

  it("verifies tenant-bound state before calling Google's token endpoint", async () => {
    const tx = start();
    let calls = 0;
    const out = await completeGoogleSearchConsoleAuthorization(completionInput(tx, {
      organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      fetchImpl: async () => { calls += 1; throw new Error("must not call provider"); }
    }));
    assert.equal(out.ok, false);
    assert.equal(out.code, "oauth_transaction_invalid");
    assert.equal(calls, 0);
    assert.equal(out.tokenMaterialReturned, false);
  });

  it("exchanges once, probes accessible properties, stores only the refresh-token reference and returns no token", async () => {
    const tx = start();
    const calls = [];
    let stored = null;
    const fetchImpl = async (url, options = {}) => {
      calls.push({ url: String(url), options });
      if (String(url) === GOOGLE_TOKEN_ENDPOINT) {
        const body = new URLSearchParams(options.body);
        assert.equal(body.get("code"), "authorization-code-once");
        assert.equal(body.get("client_id"), CLIENT_ID);
        assert.equal(body.get("client_secret"), CLIENT_SECRET);
        assert.equal(body.get("redirect_uri"), REDIRECT);
        assert.equal(body.get("grant_type"), "authorization_code");
        assert.match(body.get("code_verifier"), /^[A-Za-z0-9_-]{43,128}$/);
        return response(200, {
          access_token: "ephemeral-access-token",
          refresh_token: "durable-refresh-token",
          expires_in: 3600,
          token_type: "Bearer",
          scope: READONLY_SCOPE
        });
      }
      assert.match(String(url), /\/webmasters\/v3\/sites$/);
      assert.equal(options.headers.authorization, "Bearer ephemeral-access-token");
      return response(200, {
        siteEntry: [
          { siteUrl: "sc-domain:example.com", permissionLevel: "siteOwner" },
          { siteUrl: "https://example.com/", permissionLevel: "siteFullUser" }
        ]
      });
    };

    const out = await completeGoogleSearchConsoleAuthorization(completionInput(tx, {
      fetchImpl,
      sleepImpl: async () => undefined,
      storeRefreshToken: async (input) => {
        stored = input;
        return { ok: true, credentialReference: "vault://customer-providers/gsc-1" };
      }
    }));

    assert.equal(out.ok, true);
    assert.equal(out.state, "provider_connection_authorization_review_ready");
    assert.equal(out.credentialReference, "vault://customer-providers/gsc-1");
    assert.deepEqual(out.grantedScopes, [READONLY_SCOPE]);
    assert.equal(out.sites.length, 2);
    assert.equal(out.accessTokenReturned, false);
    assert.equal(out.refreshTokenReturned, false);
    assert.equal(out.runtimeAuthorityGranted, false);
    assert.equal(out.backgroundSyncEnabled, false);
    assert.equal(stored.refreshToken, "durable-refresh-token");
    assert.equal(stored.organizationId, ORG);
    assert.equal(stored.connectionId, CONNECTION);
    assert.equal(calls.length, 2);
    assert.equal(JSON.stringify(out).includes("ephemeral-access-token"), false);
    assert.equal(JSON.stringify(out).includes("durable-refresh-token"), false);
    assert.equal(JSON.stringify(out).includes(CLIENT_SECRET), false);
  });

  it("accepts an omitted token-response scope only because this flow requested one exact scope", async () => {
    const tx = start();
    const out = await completeGoogleSearchConsoleAuthorization(completionInput(tx, {
      fetchImpl: async (url) => {
        if (String(url) === GOOGLE_TOKEN_ENDPOINT) {
          return response(200, {
            access_token: "ephemeral-access-token",
            refresh_token: "durable-refresh-token",
            expires_in: 3600,
            token_type: "Bearer"
          });
        }
        return response(200, { siteEntry: [] });
      },
      storeRefreshToken: async () => ({
        ok: true,
        credentialReference: "vault://customer-providers/gsc-no-scope"
      })
    }));
    assert.equal(out.ok, true);
    assert.deepEqual(out.grantedScopes, [READONLY_SCOPE]);
  });

  it("refuses a write or broader Google scope before property discovery or secret storage", async () => {
    const tx = start();
    let calls = 0;
    let stores = 0;
    const out = await completeGoogleSearchConsoleAuthorization(completionInput(tx, {
      fetchImpl: async (url) => {
        calls += 1;
        assert.equal(String(url), GOOGLE_TOKEN_ENDPOINT);
        return response(200, {
          access_token: "token",
          refresh_token: "refresh",
          expires_in: 3600,
          token_type: "Bearer",
          scope: `${READONLY_SCOPE} ${GOOGLE_WRITE_SCOPE}`
        });
      },
      storeRefreshToken: async () => { stores += 1; return { ok: true, credentialReference: "vault://unexpected" }; }
    }));
    assert.equal(out.ok, false);
    assert.equal(out.code, "oauth_write_scope_granted_refused");
    assert.equal(calls, 1);
    assert.equal(stores, 0);
    assert.equal(JSON.stringify(out).includes("token"), false);
  });

  it("requires durable refresh-token custody before declaring a new connection ready", async () => {
    const tx = start();
    const fetchImpl = async (url) => {
      if (String(url) === GOOGLE_TOKEN_ENDPOINT) {
        return response(200, {
          access_token: "token",
          refresh_token: "refresh",
          expires_in: 3600,
          token_type: "Bearer",
          scope: READONLY_SCOPE
        });
      }
      return response(200, { siteEntry: [] });
    };
    const noBroker = await completeGoogleSearchConsoleAuthorization(completionInput(tx, { fetchImpl }));
    assert.equal(noBroker.ok, false);
    assert.equal(noBroker.code, "provider_refresh_token_store_required");

    const badBroker = await completeGoogleSearchConsoleAuthorization(completionInput(tx, {
      fetchImpl,
      storeRefreshToken: async () => ({ ok: true, credentialReference: "raw-refresh-token" })
    }));
    assert.equal(badBroker.ok, false);
    assert.equal(badBroker.code, "provider_refresh_token_store_failed");
  });

  it("can keep an existing opaque refresh credential when Google omits refresh_token on reauthorization", async () => {
    const tx = start();
    let stores = 0;
    const fetchImpl = async (url) => {
      if (String(url) === GOOGLE_TOKEN_ENDPOINT) {
        return response(200, {
          access_token: "token",
          expires_in: 3600,
          token_type: "Bearer",
          scope: READONLY_SCOPE
        });
      }
      return response(200, { siteEntry: [{ siteUrl: "sc-domain:example.com", permissionLevel: "siteOwner" }] });
    };
    const out = await completeGoogleSearchConsoleAuthorization(completionInput(tx, {
      fetchImpl,
      existingCredentialReference: "vault://customer-providers/gsc-existing",
      storeRefreshToken: async () => { stores += 1; throw new Error("must not store"); }
    }));
    assert.equal(out.ok, true);
    assert.equal(out.credentialReference, "vault://customer-providers/gsc-existing");
    assert.equal(stores, 0);
  });

  it("does not retry a one-time authorization-code exchange after network ambiguity", async () => {
    const tx = start();
    let calls = 0;
    const out = await completeGoogleSearchConsoleAuthorization(completionInput(tx, {
      fetchImpl: async () => {
        calls += 1;
        throw new Error("ambiguous network failure");
      }
    }));
    assert.equal(out.ok, false);
    assert.equal(out.code, "oauth_token_exchange_network_error");
    assert.equal(calls, 1);
  });

  it("propagates quota deferral from the property probe instead of claiming the connection is ready", async () => {
    const tx = start();
    let calls = 0;
    const fetchImpl = async (url) => {
      calls += 1;
      if (String(url) === GOOGLE_TOKEN_ENDPOINT) {
        return response(200, {
          access_token: "token",
          refresh_token: "refresh",
          expires_in: 3600,
          token_type: "Bearer",
          scope: READONLY_SCOPE
        });
      }
      return response(429, { error: { status: "RESOURCE_EXHAUSTED" } });
    };
    const out = await completeGoogleSearchConsoleAuthorization(completionInput(tx, {
      fetchImpl,
      storeRefreshToken: async () => ({ ok: true, credentialReference: "vault://should-not-store-yet" })
    }));
    assert.equal(out.ok, false);
    assert.equal(out.code, "provider_rate_limited");
    assert.equal(out.retryMode, "durable_deferred");
    assert.equal(calls, 2);
  });

  it("runs a daily read by resolving the refresh credential only inside the broker", async () => {
    const calls = [];
    let resolves = 0;
    const fetchImpl = async (url, options = {}) => {
      calls.push({ url: String(url), options });
      if (String(url) === GOOGLE_TOKEN_ENDPOINT) {
        const body = new URLSearchParams(options.body);
        assert.equal(body.get("grant_type"), "refresh_token");
        assert.equal(body.get("refresh_token"), "stored-refresh-token");
        return response(200, {
          access_token: "ephemeral-sync-token",
          expires_in: 3600,
          token_type: "Bearer"
        });
      }
      const requestBody = JSON.parse(options.body);
      assert.equal(options.headers.authorization, "Bearer ephemeral-sync-token");
      if (requestBody.dimensions) return response(200, { rows: [] });
      return response(200, { rows: [{ clicks: 0, impressions: 0, ctr: 0, position: 0 }] });
    };

    const out = await runGoogleSearchConsoleDailySync({
      organizationId: ORG,
      businessId: BUSINESS,
      userId: USER,
      connectionId: CONNECTION,
      credentialReference: "vault://customer-providers/gsc-1",
      grantedScopes: [READONLY_SCOPE],
      siteUrl: "sc-domain:example.com",
      date: "2026-10-07",
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      resolveRefreshToken: async (input) => {
        resolves += 1;
        assert.equal(input.organizationId, ORG);
        assert.equal(input.connectionId, CONNECTION);
        return { refreshToken: "stored-refresh-token" };
      },
      fetchImpl,
      sleepImpl: async () => undefined
    });

    assert.equal(out.ok, true);
    assert.equal(out.report.provider, "google_search_console");
    assert.equal(out.report.rowCount, 0);
    assert.equal(resolves, 1);
    assert.equal(calls.length, 3);
    assert.equal(JSON.stringify(out).includes("stored-refresh-token"), false);
    assert.equal(JSON.stringify(out).includes("ephemeral-sync-token"), false);
  });

  it("requires reauthorization when Google's refresh grant is invalid", async () => {
    const out = await runGoogleSearchConsoleDailySync({
      organizationId: ORG,
      businessId: BUSINESS,
      userId: USER,
      connectionId: CONNECTION,
      credentialReference: "vault://customer-providers/gsc-1",
      grantedScopes: [READONLY_SCOPE],
      siteUrl: "sc-domain:example.com",
      date: "2026-10-07",
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      resolveRefreshToken: async () => ({ refreshToken: "stored-refresh-token" }),
      fetchImpl: async (url) => {
        assert.equal(String(url), GOOGLE_TOKEN_ENDPOINT);
        return response(400, { error: "invalid_grant" });
      }
    });
    assert.equal(out.ok, false);
    assert.equal(out.code, "provider_reauthorization_required");
    assert.equal(out.credentialInvalidated, true);
  });

  it("will not silently discard a rotated long-lived refresh credential", async () => {
    const out = await runGoogleSearchConsoleDailySync({
      organizationId: ORG,
      businessId: BUSINESS,
      userId: USER,
      connectionId: CONNECTION,
      credentialReference: "vault://customer-providers/gsc-1",
      grantedScopes: [READONLY_SCOPE],
      siteUrl: "sc-domain:example.com",
      date: "2026-10-07",
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      resolveRefreshToken: async () => ({ refreshToken: "stored-refresh-token" }),
      fetchImpl: async () => response(200, {
        access_token: "ephemeral-sync-token",
        refresh_token: "rotated-refresh-token",
        expires_in: 3600,
        token_type: "Bearer"
      })
    });
    assert.equal(out.ok, false);
    assert.equal(out.code, "provider_refresh_token_rotation_requires_persistence");
    assert.equal(JSON.stringify(out).includes("rotated-refresh-token"), false);
  });

  it("refuses background sync if the stored connection authority is broader than read-only", async () => {
    let resolved = 0;
    const out = await runGoogleSearchConsoleDailySync({
      organizationId: ORG,
      businessId: BUSINESS,
      userId: USER,
      connectionId: CONNECTION,
      credentialReference: "vault://customer-providers/gsc-1",
      grantedScopes: [READONLY_SCOPE, GOOGLE_WRITE_SCOPE],
      siteUrl: "sc-domain:example.com",
      date: "2026-10-07",
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      resolveRefreshToken: async () => { resolved += 1; return { refreshToken: "must-not-resolve" }; }
    });
    assert.equal(out.ok, false);
    assert.equal(out.code, "least_privilege_exact_scope_required");
    assert.equal(resolved, 0);
  });

  it("revokes Google before deleting the local credential and proves both outcomes", async () => {
    const order = [];
    const out = await revokeGoogleSearchConsoleAuthorization({
      organizationId: ORG,
      businessId: BUSINESS,
      userId: USER,
      connectionId: CONNECTION,
      credentialReference: "vault://customer-providers/gsc-1",
      resolveRefreshToken: async () => ({ refreshToken: "stored-refresh-token" }),
      fetchImpl: async (url, options) => {
        order.push("provider");
        assert.equal(String(url), GOOGLE_REVOKE_ENDPOINT);
        assert.equal(new URLSearchParams(options.body).get("token"), "stored-refresh-token");
        return response(200, {});
      },
      revokeStoredSecret: async (input) => {
        order.push("local");
        assert.equal(input.credentialReference, "vault://customer-providers/gsc-1");
        return { ok: true, revoked: true };
      }
    });
    assert.equal(out.ok, true);
    assert.equal(out.providerRevoked, true);
    assert.equal(out.localCredentialRevoked, true);
    assert.deepEqual(order, ["provider", "local"]);
    assert.equal(JSON.stringify(out).includes("stored-refresh-token"), false);
  });

  it("does not delete the local credential when Google revocation is unverified", async () => {
    let localDeletes = 0;
    const out = await revokeGoogleSearchConsoleAuthorization({
      organizationId: ORG,
      businessId: BUSINESS,
      userId: USER,
      connectionId: CONNECTION,
      credentialReference: "vault://customer-providers/gsc-1",
      resolveRefreshToken: async () => ({ refreshToken: "stored-refresh-token" }),
      fetchImpl: async () => response(400, { error: "invalid_token" }),
      revokeStoredSecret: async () => {
        localDeletes += 1;
        return { ok: true, revoked: true };
      }
    });
    assert.equal(out.ok, false);
    assert.equal(out.code, "provider_revoke_unverified");
    assert.equal(localDeletes, 0);
  });

  it("reports partial disconnect when Google revokes but local credential cleanup fails", async () => {
    const out = await revokeGoogleSearchConsoleAuthorization({
      organizationId: ORG,
      businessId: BUSINESS,
      userId: USER,
      connectionId: CONNECTION,
      credentialReference: "vault://customer-providers/gsc-1",
      resolveRefreshToken: async () => ({ refreshToken: "stored-refresh-token" }),
      fetchImpl: async () => response(200, {}),
      revokeStoredSecret: async () => ({ ok: false, revoked: false })
    });
    assert.equal(out.ok, false);
    assert.equal(out.code, "provider_revoked_local_credential_cleanup_failed");
    assert.equal(out.providerRevoked, true);
    assert.equal(out.localCredentialRevoked, false);
  });
});
