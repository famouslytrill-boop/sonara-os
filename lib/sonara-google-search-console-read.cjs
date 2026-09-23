// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { createHash } = require("node:crypto");

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

function errorCode(status) {
  if (status === 401) return "provider_reauthorization_required";
  if (status === 403) return "provider_permission_denied";
  if (status === 429) return "provider_rate_limited";
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
    try {
      response = await fetchImpl(url.toString(), {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          accept: "application/json",
          ...(body === undefined ? {} : { "content-type": "application/json" })
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: "error"
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

    const retryable = response.status === 429 || response.status >= 500;
    if (retryable && attempt < MAX_ATTEMPTS) {
      await sleepImpl(retryDelay(response));
      continue;
    }

    return {
      ok: false,
      code: errorCode(response.status),
      status: response.status,
      attempts: attempt,
      retries: attempt - 1,
      providerStatus: text(payload?.error?.status) || null
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
  const material = JSON.stringify({
    provider: report.provider,
    capability: report.capability,
    siteUrl: report.siteUrl,
    date: report.date,
    summary: report.summary,
    observed: report.observed,
    rowCount: report.rows.length,
    firstPage: report.rows[0]?.page || null,
    lastPage: report.rows.at(-1)?.page || null
  });
  return createHash("sha256").update(material).digest("hex");
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
      completeClaimed: matched && !providerRowCapReached
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
      secrets: "server_only_credential_reference"
    }),
    sync: Object.freeze({
      recommendedWindow: "one_day",
      pageSize: PAGE_SIZE,
      providerDailyRowCeiling: MAX_DAILY_ROWS,
      boundedRetries: MAX_ATTEMPTS - 1,
      reconciliation: "property_summary_vs_page_rows"
    }),
    implementationStage: "adapter_contract",
    productionEnabled: false,
    verificationBlockers: Object.freeze([
      "tenant_oauth_credential_vault",
      "real_tenant_authorization_and_refresh_rotation",
      "persistent_checkpoint_and_canonical_report_store",
      "disconnect_revoke_and_data_deletion_evidence",
      "sandbox_provider_evidence",
      "one_tenant_production_canary",
      "exact_live_sha_and_slo_evidence"
    ]),
    evidenceUrls: Object.freeze([
      "https://developers.google.com/webmaster-tools/v1/how-tos/authorizing",
      "https://developers.google.com/webmaster-tools/v1/searchanalytics/query",
      "https://developers.google.com/webmaster-tools/limits",
      "https://developers.google.com/identity/protocols/oauth2/web-server"
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
  hasReadonlyScope,
  validSiteUrl,
  validateExecutionContext,
  listAccessibleSites,
  readDailySearchPerformance,
  getGoogleSearchConsoleReadContract
};
