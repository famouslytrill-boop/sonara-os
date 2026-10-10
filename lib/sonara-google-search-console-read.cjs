// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { createHash } = require("node:crypto");
const {
  createProviderOAuthTransaction,
  verifyProviderOAuthTransaction,
  buildProviderAuthorizationUrl
} = require("./sonara-provider-oauth-flow.cjs");
const {
  credentialReference,
  storeProviderCredential,
  withProviderCredential,
  revokeProviderCredential
} = require("./sonara-provider-secret-broker.cjs");

const PROVIDER_KEY = "google_search_console";
const CAPABILITY_KEY = "search_performance_daily_page_read";
const CANONICAL_REPORT_TYPE = "growth.search_performance_daily_page.v1";
const READONLY_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const API_ORIGIN = "https://www.googleapis.com";
const API_PREFIX = "/webmasters/v3";
const PAGE_SIZE = 25_000;
const MAX_DAILY_ROWS = 50_000;
const MAX_ATTEMPTS = 3;
const MAX_RETRY_DELAY_MS = 2_000;
const REQUEST_TIMEOUT_MS = 10_000;
const SEARCH_CONSOLE_QUOTA_RETRY_SECONDS = 15 * 60;
const PROVIDER_DATE_ZONE = "America/Los_Angeles";
const GOOGLE_AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_AUTHORIZATION_ORIGIN = "https://accounts.google.com";
const GOOGLE_WRITE_SCOPE = "https://www.googleapis.com/auth/webmasters";
const GOOGLE_REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";
const TOKEN_RETRY_DEFAULT_SECONDS = 60;

function text(value) {
  return String(value == null ? "" : value).trim();
}

function scopeSet(value) {
  if (Array.isArray(value)) return new Set(value.map(text).filter(Boolean));
  return new Set(text(value).split(/\s+/).filter(Boolean));
}

function hasReadonlyScope(value) {
  return scopeSet(value).has(READONLY_SCOPE);
}

function validIsoDay(value) {
  const day = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const parsed = new Date(`${day}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day;
}

function validSiteUrl(value) {
  const siteUrl = text(value);
  if (!siteUrl || siteUrl.length > 2048) return false;
  if (/^sc-domain:[a-z0-9.-]+$/i.test(siteUrl)) return true;
  try {
    const parsed = new URL(siteUrl);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function finiteMetric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function retryDelay(response, now = Date.now()) {
  const raw = text(response?.headers?.get?.("retry-after"));
  if (!raw) return 250;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(MAX_RETRY_DELAY_MS, Math.round(seconds * 1000));
  }
  const timestamp = Date.parse(raw);
  if (!Number.isFinite(timestamp)) return 250;
  return Math.min(MAX_RETRY_DELAY_MS, Math.max(0, timestamp - now));
}

function providerErrorReason(payload = {}) {
  const reason = payload?.error?.errors?.[0]?.reason;
  return text(reason || payload?.error?.status);
}

function quotaRetryAfterSeconds(response, fallbackSeconds = SEARCH_CONSOLE_QUOTA_RETRY_SECONDS) {
  const header = text(response?.headers?.get?.("retry-after"));
  if (!header) return fallbackSeconds;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(24 * 60 * 60, Math.ceil(seconds));
  // HTTP-date Retry-After values require a trusted current timestamp to turn
  // into a duration. This pure adapter has no time authority, so it falls back
  // to Search Console's documented quota wait instead of consulting Date.now().
  return fallbackSeconds;
}

function errorCode(status, payload) {
  const reason = providerErrorReason(payload).toLowerCase();
  if (status === 401) return "provider_reauthorization_required";
  if (status === 429 || ["quotaexceeded", "ratelimitexceeded", "resource_exhausted"].includes(reason)) {
    return "provider_rate_limited";
  }
  if (status === 403) return "provider_permission_denied";
  if (status >= 500) return "provider_unavailable";
  return "provider_request_failed";
}

async function providerRequest({
  path,
  method = "GET",
  accessToken,
  body,
  fetchImpl = globalThis.fetch,
  sleepImpl = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
}) {
  if (typeof fetchImpl !== "function") {
    return { ok: false, code: "provider_fetch_unavailable", status: 503, attempts: 0, retries: 0 };
  }

  const token = text(accessToken);
  if (!token) {
    return { ok: false, code: "provider_access_token_required", status: 401, attempts: 0, retries: 0 };
  }

  const url = new URL(path, API_ORIGIN);
  if (url.origin !== API_ORIGIN || !url.pathname.startsWith(API_PREFIX)) {
    return { ok: false, code: "provider_endpoint_refused", status: 400, attempts: 0, retries: 0 };
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let response;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      response = await fetchImpl(url.toString(), {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          accept: "application/json",
          ...(body === undefined ? {} : { "content-type": "application/json" })
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: "error",
        signal: controller.signal
      });
    } catch {
      if (attempt < MAX_ATTEMPTS) {
        await sleepImpl(Math.min(MAX_RETRY_DELAY_MS, 250 * attempt));
        continue;
      }
      return {
        ok: false,
        code: "provider_network_error",
        status: 503,
        attempts: attempt,
        retries: attempt - 1
      };
    } finally {
      clearTimeout(timeout);
    }

    let payload = {};
    const raw = await response.text().catch(() => "");
    if (raw) {
      try {
        payload = JSON.parse(raw);
      } catch {
        payload = {};
      }
    }

    if (response.ok) {
      return {
        ok: true,
        status: response.status,
        payload,
        attempts: attempt,
        retries: attempt - 1
      };
    }

    const classified = errorCode(response.status, payload);
    if (classified === "provider_rate_limited") {
      const retryAfterSeconds = quotaRetryAfterSeconds(response);
      return {
        ok: false,
        code: classified,
        status: response.status,
        attempts: attempt,
        retries: attempt - 1,
        providerStatus: providerErrorReason(payload) || null,
        retryMode: "durable_deferred",
        retryAfterSeconds
      };
    }
    if (response.status >= 500 && attempt < MAX_ATTEMPTS) {
      await sleepImpl(retryDelay(response));
      continue;
    }

    return {
      ok: false,
      code: classified,
      status: response.status,
      attempts: attempt,
      retries: attempt - 1,
      providerStatus: providerErrorReason(payload) || null
    };
  }

  return { ok: false, code: "provider_request_failed", status: 502, attempts: MAX_ATTEMPTS, retries: MAX_ATTEMPTS - 1 };
}

function validateExecutionContext(input = {}) {
  for (const key of ["organizationId", "businessId", "connectionId"]) {
    if (!text(input[key])) return { ok: false, code: `${key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}_required` };
  }
  if (!hasReadonlyScope(input.grantedScopes)) {
    return { ok: false, code: "least_privilege_readonly_scope_required" };
  }
  if (!validSiteUrl(input.siteUrl)) return { ok: false, code: "valid_search_console_site_required" };
  if (!validIsoDay(input.date)) return { ok: false, code: "valid_single_day_required" };
  return { ok: true };
}

function metricsFrom(row = {}) {
  return Object.freeze({
    clicks: finiteMetric(row.clicks),
    impressions: finiteMetric(row.impressions),
    ctr: finiteMetric(row.ctr),
    position: finiteMetric(row.position)
  });
}

function canonicalPageRow({ row, siteUrl, date, organizationId, businessId, connectionId, ordinal }) {
  const page = text(Array.isArray(row?.keys) ? row.keys[0] : "");
  return Object.freeze({
    objectType: CANONICAL_REPORT_TYPE,
    provider: PROVIDER_KEY,
    capability: CAPABILITY_KEY,
    organizationId,
    businessId,
    connectionId,
    source: Object.freeze({
      siteUrl,
      date,
      dimension: "page",
      providerRowOrdinal: ordinal
    }),
    page: page || null,
    metrics: metricsFrom(row)
  });
}

function totals(rows) {
  return rows.reduce((sum, row) => {
    sum.clicks += finiteMetric(row?.metrics?.clicks);
    sum.impressions += finiteMetric(row?.metrics?.impressions);
    return sum;
  }, { clicks: 0, impressions: 0 });
}

function stableReportHash(report) {
  const hash = createHash("sha256");
  hash.update(JSON.stringify({
    provider: report.provider,
    capability: report.capability,
    siteUrl: report.siteUrl,
    date: report.date,
    summary: report.summary,
    observed: report.observed,
    rowCount: report.rows.length
  }));
  for (const row of report.rows) {
    hash.update(JSON.stringify([row.page, row.metrics]));
  }
  return hash.digest("hex");
}

async function listAccessibleSites({
  organizationId,
  businessId,
  connectionId,
  grantedScopes,
  accessToken,
  fetchImpl,
  sleepImpl
} = {}) {
  if (!text(organizationId) || !text(businessId) || !text(connectionId)) {
    return { ok: false, code: "tenant_connection_scope_required" };
  }
  if (!hasReadonlyScope(grantedScopes)) {
    return { ok: false, code: "least_privilege_readonly_scope_required" };
  }

  const result = await providerRequest({
    path: `${API_PREFIX}/sites`,
    accessToken,
    fetchImpl,
    sleepImpl
  });
  if (!result.ok) return result;

  const siteEntry = Array.isArray(result.payload?.siteEntry) ? result.payload.siteEntry : [];
  return {
    ok: true,
    provider: PROVIDER_KEY,
    capability: "sites_list_read",
    attempts: result.attempts,
    retries: result.retries,
    sites: siteEntry
      .filter((entry) => validSiteUrl(entry?.siteUrl))
      .map((entry) => Object.freeze({
        siteUrl: text(entry.siteUrl),
        permissionLevel: text(entry.permissionLevel) || "unknown"
      }))
  };
}

async function querySearchAnalytics({ accessToken, siteUrl, request, fetchImpl, sleepImpl }) {
  return providerRequest({
    path: `${API_PREFIX}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    method: "POST",
    accessToken,
    body: request,
    fetchImpl,
    sleepImpl
  });
}

async function readDailySearchPerformance(input = {}) {
  const validated = validateExecutionContext(input);
  if (!validated.ok) return validated;

  const {
    organizationId,
    businessId,
    connectionId,
    siteUrl,
    date,
    accessToken,
    fetchImpl,
    sleepImpl
  } = input;

  let requestCount = 0;
  let retryCount = 0;

  const summaryResult = await querySearchAnalytics({
    accessToken,
    siteUrl,
    request: {
      startDate: date,
      endDate: date,
      type: "web",
      dataState: "final",
      rowLimit: 1,
      startRow: 0
    },
    fetchImpl,
    sleepImpl
  });
  requestCount += summaryResult.attempts || 0;
  retryCount += summaryResult.retries || 0;
  if (!summaryResult.ok) return { ...summaryResult, phase: "summary" };

  const summaryRow = Array.isArray(summaryResult.payload?.rows) ? summaryResult.payload.rows[0] : null;
  const summary = metricsFrom(summaryRow || {});

  const rows = [];
  let providerRowCapReached = false;

  for (let startRow = 0; startRow < MAX_DAILY_ROWS; startRow += PAGE_SIZE) {
    const pageResult = await querySearchAnalytics({
      accessToken,
      siteUrl,
      request: {
        startDate: date,
        endDate: date,
        dimensions: ["page"],
        type: "web",
        dataState: "final",
        rowLimit: PAGE_SIZE,
        startRow
      },
      fetchImpl,
      sleepImpl
    });
    requestCount += pageResult.attempts || 0;
    retryCount += pageResult.retries || 0;
    if (!pageResult.ok) return { ...pageResult, phase: "page", startRow };

    const providerRows = Array.isArray(pageResult.payload?.rows) ? pageResult.payload.rows : [];
    for (const row of providerRows) {
      rows.push(canonicalPageRow({
        row,
        siteUrl,
        date,
        organizationId,
        businessId,
        connectionId,
        ordinal: rows.length
      }));
    }

    if (providerRows.length < PAGE_SIZE) break;
    if (startRow + PAGE_SIZE >= MAX_DAILY_ROWS) providerRowCapReached = true;
  }

  const observed = totals(rows);
  const delta = Object.freeze({
    clicks: summary.clicks - observed.clicks,
    impressions: summary.impressions - observed.impressions
  });
  const matched = delta.clicks === 0 && delta.impressions === 0;
  const reconciliation = Object.freeze({
    status: matched ? "matched" : "provider_bounded_difference",
    matched,
    summary,
    observed,
    delta,
    providerRowCapReached,
    note: matched
      ? "Page-level totals match the provider summary for the same property and day."
      : "Search Console can return top rows rather than every row. Preserve the provider summary and this delta instead of fabricating complete coverage."
  });

  const report = {
    objectType: "growth.search_performance_daily_report.v1",
    provider: PROVIDER_KEY,
    capability: CAPABILITY_KEY,
    organizationId,
    businessId,
    connectionId,
    siteUrl,
    date,
    readOnly: true,
    rows,
    rowCount: rows.length,
    summary,
    observed,
    reconciliation,
    coverage: Object.freeze({
      pageSize: PAGE_SIZE,
      maximumRowsRequested: MAX_DAILY_ROWS,
      providerRowCapReached,
      completeClaimed: false,
      providerCoverageContract: "top_rows_not_guaranteed_exhaustive",
      providerDateZone: PROVIDER_DATE_ZONE
    }),
    health: Object.freeze({
      status: retryCount > 0 ? "recovered_after_retry" : "healthy",
      requestAttempts: requestCount,
      retries: retryCount
    })
  };

  return {
    ok: true,
    report: Object.freeze({
      ...report,
      evidenceHash: stableReportHash(report)
    })
  };
}

function exactReadonlyGrant(value) {
  const scopes = [...scopeSet(value)];
  return scopes.length === 1 && scopes[0] === READONLY_SCOPE;
}

function createGoogleSearchConsoleAuthorization({
  organizationId,
  businessId,
  userId,
  connectionId,
  redirectUri,
  clientId,
  stateSecret,
  now,
  forceConsent = false,
  randomBytesImpl
} = {}) {
  const transaction = createProviderOAuthTransaction({
    providerKey: PROVIDER_KEY,
    organizationId,
    businessId,
    userId,
    connectionId,
    redirectUri,
    requestedScopes: [READONLY_SCOPE],
    stateSecret,
    now,
    randomBytesImpl
  });
  const authorizationUrl = buildProviderAuthorizationUrl({
    authorizationEndpoint: GOOGLE_AUTHORIZATION_ENDPOINT,
    allowedAuthorizationOrigins: [GOOGLE_AUTHORIZATION_ORIGIN],
    clientId,
    transaction,
    extraParams: {
      access_type: "offline",
      ...(forceConsent === true ? { prompt: "consent" } : {})
    }
  });
  return Object.freeze({
    ok: true,
    provider: PROVIDER_KEY,
    authorizationUrl,
    transaction,
    requestedScopes: Object.freeze([READONLY_SCOPE]),
    forceConsent: forceConsent === true,
    tokenExchangeExecuted: false,
    runtimeAuthorityGranted: false
  });
}

async function exchangeGoogleAuthorizationCode({
  code,
  clientId,
  clientSecret,
  redirectUri,
  verifier,
  fetchImpl = globalThis.fetch
} = {}) {
  const cleanCode = text(code);
  const cleanClientId = text(clientId);
  const cleanClientSecret = text(clientSecret);
  if (!cleanCode) return { ok: false, code: "oauth_authorization_code_required" };
  if (!cleanClientId || !cleanClientSecret) return { ok: false, code: "oauth_client_credentials_required" };
  if (!PKCE_VALUE_FOR_GOOGLE.test(String(verifier || ""))) return { ok: false, code: "oauth_pkce_verifier_invalid" };
  if (typeof fetchImpl !== "function") return { ok: false, code: "provider_fetch_unavailable" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetchImpl(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams({
        code: cleanCode,
        client_id: cleanClientId,
        client_secret: cleanClientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: verifier
      }).toString(),
      redirect: "error",
      signal: controller.signal
    });
  } catch {
    return { ok: false, code: "oauth_token_exchange_network_error" };
  } finally {
    clearTimeout(timeout);
  }

  const raw = await response.text().catch(() => "");
  let payload = {};
  if (raw) {
    try { payload = JSON.parse(raw); } catch { payload = {}; }
  }
  if (!response.ok) {
    return {
      ok: false,
      code: "oauth_token_exchange_rejected",
      status: response.status
    };
  }

  const accessToken = text(payload.access_token);
  const refreshToken = text(payload.refresh_token);
  const tokenType = text(payload.token_type).toLowerCase();
  const expiresIn = Number(payload.expires_in);
  if (!accessToken || tokenType !== "bearer" || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    return { ok: false, code: "oauth_token_response_invalid" };
  }
  const returnedScope = text(payload.scope);
  // OAuth 2.0 permits the token response to omit scope when it is identical
  // to what the client requested. Any explicit scope still has to be exactly
  // Search Console read-only; broader authority is refused.
  if (returnedScope && !exactReadonlyGrant(returnedScope)) {
    return {
      ok: false,
      code: scopeSet(returnedScope).has(GOOGLE_WRITE_SCOPE)
        ? "oauth_write_scope_granted_refused"
        : "oauth_scope_grant_mismatch"
    };
  }
  return {
    ok: true,
    accessToken,
    refreshToken: refreshToken || null,
    grantedScopes: Object.freeze([READONLY_SCOPE]),
    expiresInSeconds: Math.floor(expiresIn)
  };
}

const PKCE_VALUE_FOR_GOOGLE = /^[A-Za-z0-9_-]{43,128}$/;

async function completeGoogleSearchConsoleAuthorization({
  state,
  cookieValue,
  stateSecret,
  now,
  organizationId,
  businessId,
  userId,
  connectionId,
  redirectUri,
  code,
  clientId,
  clientSecret,
  existingCredentialReference = null,
  storeRefreshToken,
  fetchImpl = globalThis.fetch,
  sleepImpl
} = {}) {
  const verified = verifyProviderOAuthTransaction({
    state,
    cookieValue,
    stateSecret,
    now,
    expectedProviderKey: PROVIDER_KEY,
    expectedOrganizationId: organizationId,
    expectedBusinessId: businessId,
    expectedUserId: userId,
    expectedConnectionId: connectionId,
    expectedRedirectUri: redirectUri,
    expectedScopes: [READONLY_SCOPE]
  });
  if (!verified.ok) {
    return {
      ok: false,
      code: "oauth_transaction_invalid",
      blockers: verified.blockers,
      tokenMaterialReturned: false
    };
  }

  const exchanged = await exchangeGoogleAuthorizationCode({
    code,
    clientId,
    clientSecret,
    redirectUri: verified.transaction.redirectUri,
    verifier: verified.transaction.verifier,
    fetchImpl
  });
  if (!exchanged.ok) return { ...exchanged, tokenMaterialReturned: false };

  const sites = await listAccessibleSites({
    organizationId,
    businessId,
    connectionId,
    grantedScopes: exchanged.grantedScopes,
    accessToken: exchanged.accessToken,
    fetchImpl,
    sleepImpl
  });
  if (!sites.ok) return { ...sites, tokenMaterialReturned: false };

  let storedCredentialReference = null;
  if (exchanged.refreshToken) {
    if (typeof storeRefreshToken !== "function") {
      return { ok: false, code: "provider_refresh_token_store_required", tokenMaterialReturned: false };
    }
    const stored = await storeProviderCredential({
      context: { providerKey: PROVIDER_KEY, organizationId, businessId, userId, connectionId },
      secret: exchanged.refreshToken,
      purpose: "provider_refresh_token",
      writeSecret: async (input) => storeRefreshToken({
        providerKey: input.providerKey,
        organizationId: input.organizationId,
        businessId: input.businessId,
        userId: input.userId,
        connectionId: input.connectionId,
        refreshToken: input.secret
      })
    });
    if (!stored.ok) {
      return { ok: false, code: "provider_refresh_token_store_failed", tokenMaterialReturned: false };
    }
    storedCredentialReference = stored.credentialReference;
  } else {
    try { storedCredentialReference = credentialReference(existingCredentialReference); }
    catch {
      return { ok: false, code: "provider_refresh_token_required", tokenMaterialReturned: false };
    }
  }

  const nowMs = instantForGoogle(now);
  return Object.freeze({
    ok: true,
    state: "provider_connection_authorization_review_ready",
    provider: PROVIDER_KEY,
    organizationId,
    businessId,
    userId,
    connectionId,
    credentialReference: storedCredentialReference,
    grantedScopes: Object.freeze([READONLY_SCOPE]),
    expiresAt: new Date(nowMs + (exchanged.expiresInSeconds * 1000)).toISOString(),
    sites: Object.freeze(sites.sites.map((site) => Object.freeze({ ...site }))),
    accessTokenReturned: false,
    refreshTokenReturned: false,
    runtimeAuthorityGranted: false,
    backgroundSyncEnabled: false
  });
}

function instantForGoogle(value) {
  const parsed = typeof value === "number" ? value : Date.parse(String(value || ""));
  if (!Number.isFinite(parsed)) throw new TypeError("now must be an explicit timestamp");
  return Math.trunc(parsed);
}

async function refreshGoogleSearchConsoleAccessToken({
  refreshToken,
  clientId,
  clientSecret,
  fetchImpl = globalThis.fetch
} = {}) {
  const cleanRefreshToken = text(refreshToken);
  const cleanClientId = text(clientId);
  const cleanClientSecret = text(clientSecret);
  if (!cleanRefreshToken) return { ok: false, code: "provider_refresh_token_required" };
  if (!cleanClientId || !cleanClientSecret) return { ok: false, code: "oauth_client_credentials_required" };
  if (typeof fetchImpl !== "function") return { ok: false, code: "provider_fetch_unavailable" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetchImpl(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams({
        client_id: cleanClientId,
        client_secret: cleanClientSecret,
        grant_type: "refresh_token",
        refresh_token: cleanRefreshToken
      }).toString(),
      redirect: "error",
      signal: controller.signal
    });
  } catch {
    return {
      ok: false,
      code: "provider_refresh_network_error",
      retryMode: "durable_deferred",
      retryAfterSeconds: TOKEN_RETRY_DEFAULT_SECONDS
    };
  } finally {
    clearTimeout(timeout);
  }

  const raw = await response.text().catch(() => "");
  let payload = {};
  if (raw) {
    try { payload = JSON.parse(raw); } catch { payload = {}; }
  }
  if (!response.ok) {
    const providerError = text(payload?.error);
    if (providerError === "invalid_grant") {
      return { ok: false, code: "provider_reauthorization_required", credentialInvalidated: true };
    }
    return {
      ok: false,
      code: response.status === 429 ? "provider_rate_limited" : "provider_refresh_rejected",
      status: response.status,
      retryMode: response.status === 429 || response.status >= 500 ? "durable_deferred" : "none",
      retryAfterSeconds: response.status === 429 || response.status >= 500
        ? quotaRetryAfterSeconds(response, TOKEN_RETRY_DEFAULT_SECONDS)
        : null
    };
  }

  if (text(payload.refresh_token)) {
    // Do not silently discard or overwrite provider-rotated long-lived authority.
    return { ok: false, code: "provider_refresh_token_rotation_requires_persistence" };
  }
  const accessToken = text(payload.access_token);
  const tokenType = text(payload.token_type).toLowerCase();
  const expiresIn = Number(payload.expires_in);
  if (!accessToken || tokenType !== "bearer" || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    return { ok: false, code: "provider_refresh_response_invalid" };
  }
  if (text(payload.scope) && !exactReadonlyGrant(payload.scope)) {
    return {
      ok: false,
      code: scopeSet(payload.scope).has(GOOGLE_WRITE_SCOPE)
        ? "oauth_write_scope_granted_refused"
        : "oauth_scope_grant_mismatch"
    };
  }
  return {
    ok: true,
    accessToken,
    expiresInSeconds: Math.floor(expiresIn)
  };
}

async function runGoogleSearchConsoleDailySync({
  organizationId,
  businessId,
  userId,
  connectionId,
  credentialReference: rawCredentialReference,
  grantedScopes,
  siteUrl,
  date,
  clientId,
  clientSecret,
  resolveRefreshToken,
  fetchImpl = globalThis.fetch,
  sleepImpl
} = {}) {
  const validated = validateExecutionContext({
    organizationId,
    businessId,
    connectionId,
    grantedScopes,
    siteUrl,
    date
  });
  if (!validated.ok) return validated;
  if (!exactReadonlyGrant(grantedScopes)) {
    return { ok: false, code: "least_privilege_exact_scope_required" };
  }
  const broker = await withProviderCredential({
    context: { providerKey: PROVIDER_KEY, organizationId, businessId, userId, connectionId },
    credentialReference: rawCredentialReference,
    resolveSecret: async (input) => {
      if (typeof resolveRefreshToken !== "function") throw new Error("resolver unavailable");
      const resolved = await resolveRefreshToken(input);
      return { secret: resolved?.refreshToken ?? resolved?.secret };
    },
    operation: async (refreshToken) => {
      const refreshed = await refreshGoogleSearchConsoleAccessToken({
        refreshToken,
        clientId,
        clientSecret,
        fetchImpl
      });
      if (!refreshed.ok) return refreshed;
      return readDailySearchPerformance({
        organizationId,
        businessId,
        connectionId,
        grantedScopes: [READONLY_SCOPE],
        siteUrl,
        date,
        accessToken: refreshed.accessToken,
        fetchImpl,
        sleepImpl
      });
    }
  });
  if (!broker.ok) return broker;
  return broker.result;
}

async function revokeGoogleSearchConsoleAuthorization({
  organizationId,
  businessId,
  userId,
  connectionId,
  credentialReference: rawCredentialReference,
  resolveRefreshToken,
  revokeStoredSecret,
  fetchImpl = globalThis.fetch
} = {}) {
  const context = { providerKey: PROVIDER_KEY, organizationId, businessId, userId, connectionId };
  const providerRevocation = await withProviderCredential({
    context,
    credentialReference: rawCredentialReference,
    resolveSecret: async (input) => {
      if (typeof resolveRefreshToken !== "function") throw new Error("resolver unavailable");
      const resolved = await resolveRefreshToken(input);
      return { secret: resolved?.refreshToken ?? resolved?.secret };
    },
    operation: async (refreshToken) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      let response;
      try {
        response = await fetchImpl(GOOGLE_REVOKE_ENDPOINT, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
          body: new URLSearchParams({ token: refreshToken }).toString(),
          redirect: "error",
          signal: controller.signal
        });
      } catch {
        return { ok: false, code: "provider_revoke_network_error" };
      } finally {
        clearTimeout(timeout);
      }
      return response.ok
        ? { ok: true, providerRevoked: true }
        : { ok: false, code: "provider_revoke_unverified", status: response.status };
    }
  });
  if (!providerRevocation.ok) return providerRevocation;
  if (providerRevocation.result?.ok !== true || providerRevocation.result?.providerRevoked !== true) {
    return providerRevocation.result || { ok: false, code: "provider_revoke_unverified" };
  }

  const local = await revokeProviderCredential({
    context,
    credentialReference: rawCredentialReference,
    revokeSecret: async (input) => {
      if (typeof revokeStoredSecret !== "function") return { ok: false, revoked: false };
      return revokeStoredSecret(input);
    }
  });
  if (!local.ok) {
    return {
      ok: false,
      code: "provider_revoked_local_credential_cleanup_failed",
      providerRevoked: true,
      localCredentialRevoked: false
    };
  }
  return Object.freeze({
    ok: true,
    provider: PROVIDER_KEY,
    providerRevoked: true,
    localCredentialRevoked: true,
    backgroundSyncEnabled: false,
    runtimeAuthorityGranted: false
  });
}

function getGoogleSearchConsoleReadContract() {
  return Object.freeze({
    providerKey: PROVIDER_KEY,
    capabilityKey: CAPABILITY_KEY,
    canonicalReportType: CANONICAL_REPORT_TYPE,
    product: "Growth Studio",
    executionClass: "incremental_sync",
    direction: "read_only",
    auth: Object.freeze({
      protocol: "oauth2",
      requiredScope: READONLY_SCOPE,
      offlineRefreshRequiredForBackgroundSync: true,
      secrets: "server_only_credential_reference",
      oauthTransaction: "signed_tenant_bound_pkce_s256",
      incrementalAuthorization: false,
      exactScopeGrantRequired: true,
      credentialBroker: "contract_implemented_backend_pending",
      backgroundCredentialResolution: "broker_resolved_contract_implemented",
      disconnectLifecycle: "provider_revoke_then_local_revoke_contract_implemented",
      authorizationRoute: "not_wired"
    }),
    sync: Object.freeze({
      recommendedWindow: "one_day",
      pageSize: PAGE_SIZE,
      providerDailyRowCeiling: MAX_DAILY_ROWS,
      requestTimeoutMs: REQUEST_TIMEOUT_MS,
      boundedRetries: MAX_ATTEMPTS - 1,
      quotaRetryMode: "durable_deferred",
      quotaRetryDefaultSeconds: SEARCH_CONSOLE_QUOTA_RETRY_SECONDS,
      providerDateZone: PROVIDER_DATE_ZONE,
      dataState: "final",
      reconciliation: "property_summary_vs_page_rows"
    }),
    implementationStage: "adapter_contract",
    productionEnabled: false,
    verificationBlockers: Object.freeze([
      "supabase_vault_runtime_adapter",
      "provider_oauth_route_and_cookie_wiring",
      "google_oauth_consent_and_scope_verification",
      "real_tenant_authorization_and_refresh_rotation",
      "persistent_checkpoint_and_canonical_report_store",
      "vault_backed_disconnect_and_deletion_evidence",
      "sandbox_provider_evidence",
      "one_tenant_production_canary",
      "exact_live_sha_and_slo_evidence"
    ]),
    evidenceUrls: Object.freeze([
      "https://developers.google.com/webmaster-tools/v1/how-tos/authorizing",
      "https://developers.google.com/webmaster-tools/v1/searchanalytics/query",
      "https://developers.google.com/webmaster-tools/limits",
      "https://developers.google.com/identity/protocols/oauth2/web-server",
      "https://www.rfc-editor.org/rfc/rfc9700.html",
      "https://supabase.com/docs/guides/database/vault"
    ])
  });
}

module.exports = {
  PROVIDER_KEY,
  CAPABILITY_KEY,
  CANONICAL_REPORT_TYPE,
  READONLY_SCOPE,
  PAGE_SIZE,
  MAX_DAILY_ROWS,
  SEARCH_CONSOLE_QUOTA_RETRY_SECONDS,
  PROVIDER_DATE_ZONE,
  GOOGLE_AUTHORIZATION_ENDPOINT,
  GOOGLE_TOKEN_ENDPOINT,
  GOOGLE_WRITE_SCOPE,
  GOOGLE_REVOKE_ENDPOINT,
  hasReadonlyScope,
  validSiteUrl,
  validateExecutionContext,
  listAccessibleSites,
  readDailySearchPerformance,
  createGoogleSearchConsoleAuthorization,
  completeGoogleSearchConsoleAuthorization,
  runGoogleSearchConsoleDailySync,
  revokeGoogleSearchConsoleAuthorization,
  getGoogleSearchConsoleReadContract
};
