// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const crypto = require("node:crypto");

const PROVIDER_OAUTH_FLOW_VERSION = "1.0.0";
const DEFAULT_TTL_SECONDS = 10 * 60;
const MAX_TTL_SECONDS = 15 * 60;
const COOKIE_PREFIX = "sonara_provider_oauth_";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_KEY = /^[a-z0-9][a-z0-9._:-]{1,119}$/i;
const PKCE_VALUE = /^[A-Za-z0-9_-]{43,128}$/;
const RESERVED_AUTH_PARAMS = new Set([
  "client_id","redirect_uri","response_type","scope","state",
  "code_challenge","code_challenge_method"
]);

function requiredText(value, field, max = 2048) {
  const out = String(value == null ? "" : value).trim();
  if (!out) throw new TypeError(`${field} is required`);
  if (out.length > max) throw new RangeError(`${field} exceeds ${max} characters`);
  return out;
}

function uuid(value, field) {
  const out = requiredText(value, field, 64);
  if (!UUID.test(out)) throw new TypeError(`${field} must be a UUID`);
  return out;
}

function providerKey(value) {
  const out = requiredText(value, "providerKey", 120);
  if (!SAFE_KEY.test(out)) throw new TypeError("providerKey is invalid");
  return out;
}

function scopeList(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) {
    throw new TypeError("requestedScopes must contain 1-20 scopes");
  }
  const scopes = value.map((scope) => requiredText(scope, "scope", 512));
  if (new Set(scopes).size !== scopes.length) throw new TypeError("requestedScopes contains duplicates");
  return Object.freeze([...scopes].sort());
}

function exactHttpsUrl(value, field) {
  const exact = requiredText(value, field);
  let url;
  try { url = new URL(exact); }
  catch { throw new TypeError(`${field} must be an absolute URL`); }
  if (url.protocol !== "https:" || url.username || url.password || url.hash) {
    throw new TypeError(`${field} must be an HTTPS URL without credentials or fragment`);
  }
  return exact;
}

function instant(value, field) {
  const parsed = typeof value === "number" ? value : Date.parse(String(value || ""));
  if (!Number.isFinite(parsed)) throw new TypeError(`${field} must be an explicit timestamp`);
  return Math.trunc(parsed);
}

function secretBuffer(secret) {
  const value = Buffer.isBuffer(secret) ? Buffer.from(secret) : Buffer.from(String(secret || ""), "utf8");
  if (value.length < 32) throw new TypeError("provider OAuth state secret must contain at least 32 bytes");
  return value;
}

function digestState(state) {
  return crypto.createHash("sha256").update(state, "utf8").digest("base64url");
}

function signPayload(payload64, secret) {
  return crypto.createHmac("sha256", secretBuffer(secret)).update(payload64, "utf8").digest("base64url");
}

function constantTimeEqual(left, right) {
  let a;
  let b;
  try {
    a = Buffer.from(String(left || ""), "base64url");
    b = Buffer.from(String(right || ""), "base64url");
  } catch {
    return false;
  }
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

function encodeCapsule(payload, secret) {
  const payload64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${payload64}.${signPayload(payload64, secret)}`;
}

function decodeCapsule(capsule, secret) {
  const parts = String(capsule || "").split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const expected = signPayload(parts[0], secret);
  if (!constantTimeEqual(parts[1], expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    return payload && typeof payload === "object" && !Array.isArray(payload) ? payload : null;
  } catch {
    return null;
  }
}

function randomBase64Url(bytes, randomBytesImpl) {
  const fn = typeof randomBytesImpl === "function" ? randomBytesImpl : crypto.randomBytes;
  const value = fn(bytes);
  if (!Buffer.isBuffer(value) || value.length !== bytes) {
    throw new TypeError("randomBytes implementation returned unexpected data");
  }
  return value.toString("base64url");
}

function createProviderOAuthTransaction({
  providerKey: rawProviderKey,
  organizationId,
  businessId,
  userId,
  connectionId,
  redirectUri,
  requestedScopes,
  now,
  ttlSeconds = DEFAULT_TTL_SECONDS,
  stateSecret,
  randomBytesImpl
} = {}) {
  const provider = providerKey(rawProviderKey);
  const organization = uuid(organizationId, "organizationId");
  const business = uuid(businessId, "businessId");
  const user = uuid(userId, "userId");
  const connection = uuid(connectionId, "connectionId");
  const redirect = exactHttpsUrl(redirectUri, "redirectUri");
  const scopes = scopeList(requestedScopes);
  const issuedAtMs = instant(now, "now");
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 60 || ttlSeconds > MAX_TTL_SECONDS) {
    throw new RangeError(`ttlSeconds must be between 60 and ${MAX_TTL_SECONDS}`);
  }

  const state = randomBase64Url(32, randomBytesImpl);
  const verifier = randomBase64Url(48, randomBytesImpl);
  if (!PKCE_VALUE.test(verifier)) throw new TypeError("generated PKCE verifier is invalid");
  const challenge = crypto.createHash("sha256").update(verifier, "utf8").digest("base64url");
  const expiresAtMs = issuedAtMs + (ttlSeconds * 1000);

  const payload = Object.freeze({
    v: PROVIDER_OAUTH_FLOW_VERSION,
    providerKey: provider,
    organizationId: organization,
    businessId: business,
    userId: user,
    connectionId: connection,
    redirectUri: redirect,
    requestedScopes: scopes,
    stateDigest: digestState(state),
    verifier,
    issuedAt: new Date(issuedAtMs).toISOString(),
    expiresAt: new Date(expiresAtMs).toISOString()
  });
  const cookieValue = encodeCapsule(payload, stateSecret);

  return Object.freeze({
    state,
    cookieName: `${COOKIE_PREFIX}${state}`,
    cookieValue,
    codeChallenge: challenge,
    codeChallengeMethod: "S256",
    providerKey: provider,
    redirectUri: redirect,
    requestedScopes: scopes,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
    cookieHttpOnlyRequired: true,
    cookieSecureRequiredInProduction: true,
    runtimeAuthorityGranted: false
  });
}

function verifyProviderOAuthTransaction({
  state,
  cookieValue,
  stateSecret,
  now,
  expectedProviderKey,
  expectedOrganizationId,
  expectedBusinessId,
  expectedUserId,
  expectedConnectionId,
  expectedRedirectUri,
  expectedScopes,
  allowedClockSkewSeconds = 30
} = {}) {
  const blockers = [];
  let normalizedState = "";
  try { normalizedState = requiredText(state, "state", 256); }
  catch { blockers.push("oauth_state_format_invalid"); }
  if (normalizedState && !PKCE_VALUE.test(normalizedState)) blockers.push("oauth_state_format_invalid");
  if (!Number.isInteger(allowedClockSkewSeconds) || allowedClockSkewSeconds < 0 || allowedClockSkewSeconds > 300) {
    throw new RangeError("allowedClockSkewSeconds must be between 0 and 300");
  }

  let payload = null;
  try { payload = decodeCapsule(cookieValue, stateSecret); }
  catch { payload = null; }
  if (!payload) blockers.push("oauth_state_capsule_signature_invalid");

  const nowMs = instant(now, "now");
  let expected = null;
  try {
    expected = {
      providerKey: providerKey(expectedProviderKey),
      organizationId: uuid(expectedOrganizationId, "expectedOrganizationId"),
      businessId: uuid(expectedBusinessId, "expectedBusinessId"),
      userId: uuid(expectedUserId, "expectedUserId"),
      connectionId: uuid(expectedConnectionId, "expectedConnectionId"),
      redirectUri: exactHttpsUrl(expectedRedirectUri, "expectedRedirectUri"),
      requestedScopes: scopeList(expectedScopes)
    };
  } catch {
    blockers.push("oauth_expected_binding_invalid");
  }

  if (payload) {
    if (payload.v !== PROVIDER_OAUTH_FLOW_VERSION) blockers.push("oauth_state_version_mismatch");
    if (payload.stateDigest !== digestState(normalizedState)) blockers.push("oauth_state_digest_mismatch");
    if (!PKCE_VALUE.test(String(payload.verifier || ""))) blockers.push("oauth_pkce_verifier_invalid");

    const issuedAtMs = Date.parse(String(payload.issuedAt || ""));
    const expiresAtMs = Date.parse(String(payload.expiresAt || ""));
    const skewMs = allowedClockSkewSeconds * 1000;
    if (!Number.isFinite(issuedAtMs) || !Number.isFinite(expiresAtMs) || expiresAtMs <= issuedAtMs) {
      blockers.push("oauth_state_time_invalid");
    } else {
      if (issuedAtMs > nowMs + skewMs) blockers.push("oauth_state_from_future");
      if (expiresAtMs < nowMs - skewMs) blockers.push("oauth_state_expired");
      if (expiresAtMs - issuedAtMs > MAX_TTL_SECONDS * 1000) blockers.push("oauth_state_ttl_excessive");
    }

    if (expected) {
      for (const field of ["providerKey","organizationId","businessId","userId","connectionId","redirectUri"]) {
        if (payload[field] !== expected[field]) blockers.push(`oauth_${field}_binding_mismatch`);
      }
      if (JSON.stringify(payload.requestedScopes) !== JSON.stringify(expected.requestedScopes)) {
        blockers.push("oauth_scope_binding_mismatch");
      }
    }
  }

  const ok = blockers.length === 0;
  return Object.freeze({
    ok,
    state: ok ? "oauth_transaction_verified" : "oauth_transaction_blocked",
    blockers: Object.freeze([...new Set(blockers)]),
    transaction: ok ? Object.freeze({
      providerKey: payload.providerKey,
      organizationId: payload.organizationId,
      businessId: payload.businessId,
      userId: payload.userId,
      connectionId: payload.connectionId,
      redirectUri: payload.redirectUri,
      requestedScopes: Object.freeze([...payload.requestedScopes]),
      verifier: payload.verifier,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt
    }) : null,
    tokenExchangeAuthorized: false,
    providerCallExecuted: false
  });
}

function buildProviderAuthorizationUrl({
  authorizationEndpoint,
  allowedAuthorizationOrigins,
  clientId,
  transaction,
  extraParams = {}
} = {}) {
  let endpoint;
  try { endpoint = new URL(requiredText(authorizationEndpoint, "authorizationEndpoint")); }
  catch { throw new TypeError("authorizationEndpoint must be an absolute URL"); }
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.hash) {
    throw new TypeError("authorizationEndpoint must be HTTPS without credentials or fragment");
  }
  const allowed = Array.isArray(allowedAuthorizationOrigins)
    ? allowedAuthorizationOrigins.map((value) => new URL(exactHttpsUrl(value, "allowedAuthorizationOrigin")).origin)
    : [];
  if (!allowed.includes(endpoint.origin)) throw new TypeError("authorizationEndpoint origin is not allowlisted");
  if (endpoint.search) throw new TypeError("authorizationEndpoint must not contain query parameters");
  if (!transaction || !PKCE_VALUE.test(String(transaction.state || "")) ||
      !PKCE_VALUE.test(String(transaction.codeChallenge || ""))) {
    throw new TypeError("verified provider OAuth transaction is required");
  }

  const extras = extraParams && typeof extraParams === "object" && !Array.isArray(extraParams)
    ? extraParams
    : (() => { throw new TypeError("extraParams must be an object"); })();
  for (const [key, value] of Object.entries(extras)) {
    if (RESERVED_AUTH_PARAMS.has(String(key).toLowerCase())) {
      throw new TypeError(`extraParams cannot override OAuth parameter ${key}`);
    }
    if (Array.isArray(value) || (value !== null && typeof value === "object")) {
      throw new TypeError(`extraParams.${key} must be scalar`);
    }
  }

  endpoint.searchParams.set("client_id", requiredText(clientId, "clientId", 512));
  endpoint.searchParams.set("redirect_uri", transaction.redirectUri);
  endpoint.searchParams.set("response_type", "code");
  endpoint.searchParams.set("scope", transaction.requestedScopes.join(" "));
  endpoint.searchParams.set("state", transaction.state);
  endpoint.searchParams.set("code_challenge", transaction.codeChallenge);
  endpoint.searchParams.set("code_challenge_method", "S256");
  for (const [key, value] of Object.entries(extras)) {
    if (value !== undefined && value !== null && value !== "") endpoint.searchParams.set(key, String(value));
  }
  return endpoint.toString();
}

module.exports = {
  PROVIDER_OAUTH_FLOW_VERSION,
  DEFAULT_TTL_SECONDS,
  MAX_TTL_SECONDS,
  COOKIE_PREFIX,
  createProviderOAuthTransaction,
  verifyProviderOAuthTransaction,
  buildProviderAuthorizationUrl
};
