"use strict";

const assert = require("node:assert/strict");
const {
  DEFAULT_TTL_SECONDS,
  createProviderOAuthTransaction,
  verifyProviderOAuthTransaction,
  buildProviderAuthorizationUrl
} = require("../lib/sonara-provider-oauth-flow.cjs");

const ORG = "11111111-1111-4111-8111-111111111111";
const BUSINESS = "22222222-2222-4222-8222-222222222222";
const USER = "33333333-3333-4333-8333-333333333333";
const CONNECTION = "44444444-4444-4444-8444-444444444444";
const SECRET = "provider-oauth-state-secret-that-is-deliberately-long-enough";
const REDIRECT = "https://sonaraindustries.com/oauth/google-search-console/callback";
const SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"];
const NOW = "2026-10-08T20:00:00.000Z";

function deterministicRandom(bytes) {
  return Buffer.alloc(bytes, bytes === 32 ? 7 : 9);
}

function created(overrides = {}) {
  return createProviderOAuthTransaction({
    providerKey: "google_search_console",
    organizationId: ORG,
    businessId: BUSINESS,
    userId: USER,
    connectionId: CONNECTION,
    redirectUri: REDIRECT,
    requestedScopes: SCOPES,
    now: NOW,
    stateSecret: SECRET,
    randomBytesImpl: deterministicRandom,
    ...overrides
  });
}

function verified(tx, overrides = {}) {
  return verifyProviderOAuthTransaction({
    state: tx.state,
    cookieValue: tx.cookieValue,
    stateSecret: SECRET,
    now: "2026-10-08T20:05:00.000Z",
    expectedProviderKey: "google_search_console",
    expectedOrganizationId: ORG,
    expectedBusinessId: BUSINESS,
    expectedUserId: USER,
    expectedConnectionId: CONNECTION,
    expectedRedirectUri: REDIRECT,
    expectedScopes: SCOPES,
    ...overrides
  });
}

describe("tenant-bound provider OAuth transactions", () => {
  it("creates S256 PKCE and a signed state capsule without granting provider authority", () => {
    const tx = created();
    assert.match(tx.state, /^[A-Za-z0-9_-]{43}$/);
    assert.match(tx.codeChallenge, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(tx.codeChallengeMethod, "S256");
    assert.equal(tx.requestedScopes[0], SCOPES[0]);
    assert.equal(tx.runtimeAuthorityGranted, false);
    assert.equal(tx.cookieHttpOnlyRequired, true);
    assert.ok(tx.cookieValue.includes("."));
    assert.equal(tx.cookieValue.includes(ORG), false);
    assert.equal(tx.cookieValue.includes(CONNECTION), false);
  });

  it("verifies the exact provider, tenant, user, connection, redirect and scopes", () => {
    const tx = created();
    const result = verified(tx);
    assert.equal(result.ok, true);
    assert.equal(result.state, "oauth_transaction_verified");
    assert.equal(result.transaction.organizationId, ORG);
    assert.equal(result.transaction.connectionId, CONNECTION);
    assert.equal(result.transaction.redirectUri, REDIRECT);
    assert.deepEqual(result.transaction.requestedScopes, SCOPES);
    assert.match(result.transaction.verifier, /^[A-Za-z0-9_-]{64}$/);
    assert.equal(result.tokenExchangeAuthorized, false);
  });

  it("returns a structured denial for missing or malformed callback state", () => {
    const tx = created();
    for (const state of ["", "not-valid state"]) {
      const result = verified(tx, { state });
      assert.equal(result.ok, false);
      assert.ok(result.blockers.includes("oauth_state_format_invalid"));
      assert.equal(result.transaction, null);
    }
  });

  it("rejects state or signed-capsule tampering before token exchange", () => {
    const tx = created();
    const changedState = verified(tx, { state: tx.state.slice(0, -1) + "A" });
    assert.equal(changedState.ok, false);
    assert.ok(changedState.blockers.includes("oauth_state_digest_mismatch"));

    const parts = tx.cookieValue.split(".");
    const changedCookie = verified(tx, {
      cookieValue: parts[0] + "." + parts[1].slice(0, -1) + (parts[1].endsWith("A") ? "B" : "A")
    });
    assert.equal(changedCookie.ok, false);
    assert.ok(changedCookie.blockers.includes("oauth_state_capsule_signature_invalid"));
  });

  it("rejects cross-tenant, cross-user and cross-connection replay", () => {
    const tx = created();
    for (const [field, value, code] of [
      ["expectedOrganizationId", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "oauth_organizationId_binding_mismatch"],
      ["expectedBusinessId", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "oauth_businessId_binding_mismatch"],
      ["expectedUserId", "cccccccc-cccc-4ccc-8ccc-cccccccccccc", "oauth_userId_binding_mismatch"],
      ["expectedConnectionId", "dddddddd-dddd-4ddd-8ddd-dddddddddddd", "oauth_connectionId_binding_mismatch"]
    ]) {
      const result = verified(tx, { [field]: value });
      assert.equal(result.ok, false, field);
      assert.ok(result.blockers.includes(code), field);
    }
  });

  it("rejects redirect and scope substitution", () => {
    const tx = created();
    let result = verified(tx, {
      expectedRedirectUri: "https://sonaraindustries.com/oauth/other/callback"
    });
    assert.ok(result.blockers.includes("oauth_redirectUri_binding_mismatch"));

    result = verified(tx, {
      expectedScopes: ["https://www.googleapis.com/auth/webmasters"]
    });
    assert.ok(result.blockers.includes("oauth_scope_binding_mismatch"));
  });

  it("expires deterministically and rejects excessive or future lifetimes", () => {
    const tx = created();
    assert.equal(
      Date.parse(tx.expiresAt) - Date.parse(tx.issuedAt),
      DEFAULT_TTL_SECONDS * 1000
    );
    const expired = verified(tx, { now: "2026-10-08T20:11:00.000Z", allowedClockSkewSeconds: 0 });
    assert.equal(expired.ok, false);
    assert.ok(expired.blockers.includes("oauth_state_expired"));

    assert.throws(
      () => created({ ttlSeconds: 16 * 60 }),
      /ttlSeconds/
    );
  });

  it("requires a dedicated high-entropy signing secret", () => {
    assert.throws(
      () => created({ stateSecret: "too-short" }),
      /at least 32 bytes/
    );
  });

  it("builds an allowlisted authorization-code URL and refuses core parameter overrides", () => {
    const tx = created();
    const url = new URL(buildProviderAuthorizationUrl({
      authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
      allowedAuthorizationOrigins: ["https://accounts.google.com"],
      clientId: "client-id.apps.googleusercontent.com",
      transaction: tx,
      extraParams: {
        access_type: "offline",
        include_granted_scopes: "true"
      }
    }));
    assert.equal(url.origin, "https://accounts.google.com");
    assert.equal(url.searchParams.get("response_type"), "code");
    assert.equal(url.searchParams.get("redirect_uri"), REDIRECT);
    assert.equal(url.searchParams.get("state"), tx.state);
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    assert.equal(url.searchParams.get("scope"), SCOPES[0]);
    assert.equal(url.searchParams.get("access_type"), "offline");

    assert.throws(
      () => buildProviderAuthorizationUrl({
        authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
        allowedAuthorizationOrigins: ["https://accounts.google.com"],
        clientId: "client-id.apps.googleusercontent.com",
        transaction: tx,
        extraParams: { redirect_uri: "https://attacker.example/callback" }
      }),
      /cannot override/
    );
  });

  it("refuses arbitrary authorization origins and endpoint query injection", () => {
    const tx = created();
    assert.throws(
      () => buildProviderAuthorizationUrl({
        authorizationEndpoint: "https://attacker.example/oauth",
        allowedAuthorizationOrigins: ["https://accounts.google.com"],
        clientId: "client",
        transaction: tx
      }),
      /not allowlisted/
    );
    assert.throws(
      () => buildProviderAuthorizationUrl({
        authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth?redirect_uri=https://attacker.example",
        allowedAuthorizationOrigins: ["https://accounts.google.com"],
        clientId: "client",
        transaction: tx
      }),
      /must not contain query/
    );
  });
});
