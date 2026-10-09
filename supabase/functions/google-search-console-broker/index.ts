// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.3";
import { withSupabase } from "npm:@supabase/server@1.9.1";

const VERSION = "1.0.0";
const PROVIDER = "google_search_console";
const READ_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const WRITE_SCOPE = "https://www.googleapis.com/auth/webmasters";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const API_ORIGIN = "https://www.googleapis.com";
const API_PREFIX = "/webmasters/v3";
const BROKER_PATH = "/functions/v1/google-search-console-broker";
const MAX_CLOCK_SKEW_SECONDS = 120;
const MAX_REQUEST_BYTES = 32768;
const MAX_PROVIDER_BYTES = 2097152;
const REQUEST_TIMEOUT_MS = 12000;
const QUOTA_RETRY_SECONDS = 900;
const PAGE_SIZE = 25000;
const MAX_ROWS = 50000;
const MAX_SAMPLE_ROWS = 500;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PKCE = /^[A-Za-z0-9_-]{43,128}$/;
const VAULT_REF = /^vault:\/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const OWNER_ROLES = new Set(["owner", "admin", "business_owner"]);
const OPERATIONS = new Set(["complete_authorization", "review_sites", "bind_site", "read_daily", "disconnect"]);

const encoder = new TextEncoder();

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function requiredUuid(value: unknown, field: string): string {
  const out = text(value);
  if (!UUID.test(out)) throw new Error(field + "_invalid");
  return out;
}

function validDay(value: unknown): boolean {
  const day = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const parsed = new Date(day + "T00:00:00.000Z");
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day;
}

function validSite(value: unknown): boolean {
  const site = text(value);
  if (!site || site.length > 2048) return false;
  if (/^sc-domain:[a-z0-9.-]+$/i.test(site)) return true;
  try {
    const parsed = new URL(site);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function scopes(value: unknown): string[] {
  return text(value).split(/\s+/).filter(Boolean);
}

function exactReadScope(value: unknown): boolean {
  const valueScopes = scopes(value);
  return valueScopes.length === 1 && valueScopes[0] === READ_SCOPE;
}

function vaultId(reference: unknown): string | null {
  const match = text(reference).match(VAULT_REF);
  return match ? match[1] : null;
}

function base64UrlBytes(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padding = "=".repeat((4 - normalized.length % 4) % 4);
    const decoded = atob(normalized + padding);
    return Uint8Array.from(decoded, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

function environment() {
  const databaseUrl = text(Deno.env.get("SUPABASE_DB_URL"));
  const brokerSecret = text(Deno.env.get("SONARA_PROVIDER_BROKER_TOKEN"));
  const clientId = text(Deno.env.get("GOOGLE_SEARCH_CONSOLE_CLIENT_ID"));
  const clientSecret = text(Deno.env.get("GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET"));
  const redirectUri = text(Deno.env.get("GOOGLE_SEARCH_CONSOLE_REDIRECT_URI"));
  if (!databaseUrl || brokerSecret.length < 32 || !clientId || !clientSecret || !redirectUri) {
    throw new Error("broker_environment_not_configured");
  }
  const redirect = new URL(redirectUri);
  if (redirect.protocol !== "https:" || redirect.username || redirect.password || redirect.hash) {
    throw new Error("broker_redirect_uri_invalid");
  }
  return { databaseUrl, brokerSecret, clientId, clientSecret, redirectUri };
}

async function validSignature(secret: string, timestamp: string, body: string, signature: string): Promise<boolean> {
  const seconds = Number(timestamp);
  if (!Number.isInteger(seconds) || seconds <= 0) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - seconds) > MAX_CLOCK_SKEW_SECONDS) return false;
  const match = signature.match(/^v1=([A-Za-z0-9_-]{43})$/);
  if (!match) return false;
  const bytes = base64UrlBytes(match[1]);
  if (!bytes) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const canonical = [timestamp, "POST", BROKER_PATH, body].join("\n");
  return crypto.subtle.verify("HMAC", key, bytes, encoder.encode(canonical));
}

type Context = {
  organizationId: string;
  businessId: string;
  userId: string;
  connectionId: string;
};

type Connection = {
  id: string;
  organization_id: string;
  business_id: string;
  connection_mode: string;
  connection_status: string;
  credential_reference: string | null;
  settings: Record<string, unknown>;
  role: string;
};

function parseContext(value: unknown): Context {
  const input = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return {
    organizationId: requiredUuid(input.organizationId, "organization_id"),
    businessId: requiredUuid(input.businessId, "business_id"),
    userId: requiredUuid(input.userId, "user_id"),
    connectionId: requiredUuid(input.connectionId, "connection_id")
  };
}

async function query(sql: postgres.Sql, statement: string, params: any[] = []): Promise<any[]> {
  return sql.unsafe(statement, params);
}

async function authorizedConnection(sql: postgres.Sql, context: Context): Promise<Connection | null> {
  const statement = [
    "select c.id,c.organization_id,c.business_id,c.connection_mode,c.connection_status,",
    "c.credential_reference,c.settings,m.role ",
    "from public.business_integration_connections c ",
    "join public.business_workspaces w on w.id=c.business_id and w.organization_id=c.organization_id and w.deleted_at is null ",
    "join public.organization_memberships m on m.organization_id=c.organization_id and m.user_id=$1::uuid and m.status='active' ",
    "where c.id=$2::uuid and c.organization_id=$3::uuid and c.business_id=$4::uuid and c.provider_key=$5 limit 1"
  ].join("");
  const rows = await query(sql, statement, [
    context.userId,
    context.connectionId,
    context.organizationId,
    context.businessId,
    PROVIDER
  ]);
  const connection = rows[0] as Connection | undefined;
  if (!connection || !OWNER_ROLES.has(text(connection.role))) return null;
  if (connection.connection_mode !== "oauth") return null;
  connection.settings = connection.settings && typeof connection.settings === "object" ? connection.settings : {};
  return connection;
}

async function providerFetch(url: string, init: RequestInit): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, { ...init, redirect: "error", signal: controller.signal });
  } catch {
    clearTimeout(timeout);
    return { ok: false, code: "provider_network_error", retryMode: "durable_deferred", retryAfterSeconds: 60 };
  }
  clearTimeout(timeout);
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_PROVIDER_BYTES) {
    return { ok: false, code: "provider_response_too_large", status: response.status };
  }
  let raw = "";
  try { raw = await response.text(); } catch {
    return { ok: false, code: "provider_response_unreadable", status: response.status };
  }
  if (encoder.encode(raw).byteLength > MAX_PROVIDER_BYTES) {
    return { ok: false, code: "provider_response_too_large", status: response.status };
  }
  let payload: Record<string, unknown> = {};
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("shape");
      payload = parsed;
    } catch {
      return { ok: false, code: "provider_response_invalid", status: response.status };
    }
  }
  return { ok: true, response, payload };
}

function retrySeconds(response: Response, fallback = QUOTA_RETRY_SECONDS): number {
  const seconds = Number(text(response.headers.get("retry-after")));
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(86400, Math.ceil(seconds)) : fallback;
}

async function exchangeCode(config: ReturnType<typeof environment>, code: string, verifier: string): Promise<any> {
  if (!code || code.length > 4096) return { ok: false, code: "oauth_authorization_code_invalid", status: 400 };
  if (!PKCE.test(verifier)) return { ok: false, code: "oauth_pkce_verifier_invalid", status: 400 };
  const result = await providerFetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
      code_verifier: verifier
    }).toString()
  });
  if (!result.ok) return result;
  if (!result.response.ok) return { ok: false, code: "oauth_token_exchange_rejected", status: result.response.status };
  const accessToken = text(result.payload.access_token);
  const refreshToken = text(result.payload.refresh_token);
  const tokenType = text(result.payload.token_type).toLowerCase();
  const expiresIn = Number(result.payload.expires_in);
  const returnedScope = text(result.payload.scope);
  if (!accessToken || tokenType !== "bearer" || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    return { ok: false, code: "oauth_token_response_invalid", status: 502 };
  }
  if (returnedScope && !exactReadScope(returnedScope)) {
    return {
      ok: false,
      code: scopes(returnedScope).includes(WRITE_SCOPE) ? "oauth_write_scope_refused" : "oauth_scope_mismatch",
      status: 409
    };
  }
  return { ok: true, accessToken, refreshToken: refreshToken || null };
}

async function refreshAccess(config: ReturnType<typeof environment>, refreshToken: string): Promise<any> {
  const result = await providerFetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    }).toString()
  });
  if (!result.ok) return result;
  if (!result.response.ok) {
    const status = result.response.status;
    if (text(result.payload.error) === "invalid_grant") {
      return { ok: false, code: "provider_reauthorization_required", status: 401 };
    }
    return {
      ok: false,
      code: status === 429 ? "provider_rate_limited" : "provider_refresh_rejected",
      status,
      retryMode: status === 429 || status >= 500 ? "durable_deferred" : "none",
      retryAfterSeconds: status === 429 || status >= 500 ? retrySeconds(result.response, 60) : undefined
    };
  }
  if (text(result.payload.refresh_token)) {
    return { ok: false, code: "provider_refresh_rotation_requires_persistence", status: 409 };
  }
  const accessToken = text(result.payload.access_token);
  const tokenType = text(result.payload.token_type).toLowerCase();
  const expiresIn = Number(result.payload.expires_in);
  const returnedScope = text(result.payload.scope);
  if (!accessToken || tokenType !== "bearer" || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    return { ok: false, code: "provider_refresh_response_invalid", status: 502 };
  }
  if (returnedScope && !exactReadScope(returnedScope)) {
    return {
      ok: false,
      code: scopes(returnedScope).includes(WRITE_SCOPE) ? "oauth_write_scope_refused" : "oauth_scope_mismatch",
      status: 409
    };
  }
  return { ok: true, accessToken };
}

async function googleApi(path: string, accessToken: string, body?: Record<string, unknown>): Promise<any> {
  const url = new URL(path, API_ORIGIN);
  if (url.origin !== API_ORIGIN || !url.pathname.startsWith(API_PREFIX)) {
    return { ok: false, code: "provider_endpoint_refused", status: 400 };
  }
  const result = await providerFetch(url.toString(), {
    method: body ? "POST" : "GET",
    headers: {
      authorization: "Bearer " + accessToken,
      accept: "application/json",
      ...(body ? { "content-type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!result.ok) return result;
  if (result.response.ok) return { ok: true, payload: result.payload };
  const status = result.response.status;
  return {
    ok: false,
    code: status === 401 ? "provider_reauthorization_required"
      : status === 429 ? "provider_rate_limited"
      : status === 403 ? "provider_permission_denied"
      : status >= 500 ? "provider_unavailable"
      : "provider_request_failed",
    status,
    retryMode: status === 429 || status >= 500 ? "durable_deferred" : "none",
    retryAfterSeconds: status === 429 || status >= 500 ? retrySeconds(result.response) : undefined
  };
}

async function listSites(accessToken: string): Promise<any> {
  const result = await googleApi(API_PREFIX + "/sites", accessToken);
  if (!result.ok) return result;
  const rows = Array.isArray(result.payload.siteEntry) ? result.payload.siteEntry : [];
  return {
    ok: true,
    sites: rows
      .map((entry) => entry && typeof entry === "object" ? entry as Record<string, unknown> : {})
      .filter((entry) => validSite(entry.siteUrl))
      .map((entry) => ({ siteUrl: text(entry.siteUrl), permissionLevel: text(entry.permissionLevel) || "unknown" }))
  };
}

function number(value: unknown): number {
  const output = Number(value);
  return Number.isFinite(output) ? output : 0;
}

function rowMetrics(row: Record<string, unknown>) {
  return {
    clicks: number(row.clicks),
    impressions: number(row.impressions),
    ctr: number(row.ctr),
    position: number(row.position)
  };
}

async function dailyReport(accessToken: string, siteUrl: string, date: string): Promise<any> {
  const endpoint = API_PREFIX + "/sites/" + encodeURIComponent(siteUrl) + "/searchAnalytics/query";
  const summaryResult = await googleApi(endpoint, accessToken, {
    startDate: date, endDate: date, type: "web", dataState: "final", rowLimit: 1, startRow: 0
  });
  if (!summaryResult.ok) return summaryResult;
  const summaryRows = Array.isArray(summaryResult.payload.rows) ? summaryResult.payload.rows : [];
  const summary = rowMetrics((summaryRows[0] || {}) as Record<string, unknown>);
  let rowCount = 0;
  let clicks = 0;
  let impressions = 0;
  let capReached = false;
  const sampleRows: Array<Record<string, unknown>> = [];
  for (let startRow = 0; startRow < MAX_ROWS; startRow += PAGE_SIZE) {
    const page = await googleApi(endpoint, accessToken, {
      startDate: date,
      endDate: date,
      dimensions: ["page"],
      type: "web",
      dataState: "final",
      rowLimit: PAGE_SIZE,
      startRow
    });
    if (!page.ok) return page;
    const rows = Array.isArray(page.payload.rows) ? page.payload.rows : [];
    for (const item of rows) {
      const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
      const metrics = rowMetrics(row);
      rowCount += 1;
      clicks += metrics.clicks;
      impressions += metrics.impressions;
      if (sampleRows.length < MAX_SAMPLE_ROWS) {
        const keys = Array.isArray(row.keys) ? row.keys : [];
        sampleRows.push({ page: text(keys[0]) || null, metrics });
      }
    }
    if (rows.length < PAGE_SIZE) break;
    if (startRow + PAGE_SIZE >= MAX_ROWS) capReached = true;
  }
  const observed = { clicks, impressions };
  const delta = { clicks: summary.clicks - clicks, impressions: summary.impressions - impressions };
  const matched = delta.clicks === 0 && delta.impressions === 0;
  const report = {
    provider: PROVIDER,
    reportType: "growth.search_performance_daily_broker_report.v1",
    siteUrl,
    date,
    providerDateZone: "America/Los_Angeles",
    dataState: "final",
    rowCount,
    sampleRowCount: sampleRows.length,
    sampleRows,
    summary,
    observed,
    reconciliation: {
      status: matched ? "matched" : "provider_bounded_difference",
      matched,
      delta,
      providerRowCapReached: capReached
    },
    coverage: {
      pageSize: PAGE_SIZE,
      maximumRowsRequested: MAX_ROWS,
      sampleRowsMaximum: MAX_SAMPLE_ROWS,
      providerRowCapReached: capReached,
      completeClaimed: false,
      providerCoverageContract: "top_rows_not_guaranteed_exhaustive"
    }
  };
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(JSON.stringify(report)));
  const evidenceHash = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return { ok: true, report: { ...report, evidenceHash } };
}

async function resolveRefresh(sql: postgres.Sql, connection: Connection): Promise<string | null> {
  const id = vaultId(connection.credential_reference);
  if (!id) return null;
  const rows = await query(
    sql,
    "select decrypted_secret from vault.decrypted_secrets where id=$1::uuid limit 1",
    [id]
  );
  return text(rows[0]?.decrypted_secret) || null;
}

async function storeRefresh(sql: postgres.Sql, context: Context, connection: Connection, refreshToken: string) {
  return sql.begin(async (tx) => {
    let id = vaultId(connection.credential_reference);
    const name = "sonara:" + PROVIDER + ":" + context.connectionId + ":refresh";
    const description = "SONARA " + PROVIDER + " refresh credential for connection " + context.connectionId;
    if (id) {
      await tx.unsafe("select vault.update_secret($1::uuid,$2,$3,$4)", [id, refreshToken, name, description]);
    } else {
      const created = await tx.unsafe(
        "select vault.create_secret($1,$2,$3) as id",
        [refreshToken, name, description]
      );
      id = text(created[0]?.id);
    }
    if (!id || !UUID.test(id)) throw new Error("vault_secret_store_failed");
    const reference = "vault://" + id;
    const updated = await tx.unsafe(
      "update public.business_integration_connections set credential_reference=$1,connection_status='setup_required',last_checked_at=now(),updated_at=now() where id=$2::uuid and organization_id=$3::uuid and business_id=$4::uuid and provider_key=$5 and credential_reference is not distinct from $6 returning id",
      [reference, context.connectionId, context.organizationId, context.businessId, PROVIDER, connection.credential_reference]
    );
    if (!updated[0]?.id) throw new Error("connection_update_failed");
    return reference;
  });
}

function providerSettings(connection: Connection): Record<string, unknown> {
  const root = connection.settings && typeof connection.settings === "object" ? connection.settings : {};
  const value = root.google_search_console;
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

async function saveSettings(
  sql: postgres.Sql,
  context: Context,
  connection: Connection,
  patch: Record<string, unknown>,
  status: string
): Promise<boolean> {
  const root = connection.settings && typeof connection.settings === "object" ? connection.settings : {};
  const next = { ...root, google_search_console: { ...providerSettings(connection), ...patch } };
  const updated = await query(
    sql,
    "update public.business_integration_connections set settings=$1::jsonb,connection_status=$2,last_checked_at=now(),updated_at=now() where id=$3::uuid and organization_id=$4::uuid and business_id=$5::uuid and provider_key=$6 and credential_reference is not distinct from $7 returning id",
    [
      JSON.stringify(next),
      status,
      context.connectionId,
      context.organizationId,
      context.businessId,
      PROVIDER,
      connection.credential_reference
    ]
  );
  return Boolean(updated[0]?.id);
}

async function brokerAccess(sql: postgres.Sql, config: ReturnType<typeof environment>, connection: Connection): Promise<any> {
  const refreshToken = await resolveRefresh(sql, connection);
  if (!refreshToken) return { ok: false, code: "provider_refresh_credential_missing", status: 409 };
  return refreshAccess(config, refreshToken);
}

async function completeAuthorization(
  sql: postgres.Sql,
  config: ReturnType<typeof environment>,
  context: Context,
  connection: Connection,
  payload: Record<string, unknown>
) {
  if (connection.connection_status === "disabled") {
    return { status: 409, body: { ok: false, code: "connection_disabled" } };
  }
  const exchange = await exchangeCode(config, text(payload.code), text(payload.verifier));
  if (!exchange.ok) return { status: exchange.status || 400, body: exchange };
  let reference = connection.credential_reference;
  if (exchange.refreshToken) {
    try { reference = await storeRefresh(sql, context, connection, exchange.refreshToken); }
    catch { return { status: 503, body: { ok: false, code: "provider_refresh_token_store_failed" } }; }
  } else if (!vaultId(reference)) {
    return { status: 409, body: { ok: false, code: "provider_refresh_token_required" } };
  }
  const sites = await listSites(exchange.accessToken);
  if (!sites.ok) {
    const staged = await saveSettings(
      sql,
      context,
      { ...connection, credential_reference: reference },
      {
        oauth_stage: "credential_stored_provider_probe_pending",
        granted_scopes: [READ_SCOPE],
        provider_probe_pending_at: new Date().toISOString(),
        provider_probe_error_code: text(sites.code) || "provider_probe_failed"
      },
      "setup_required"
    );
    if (!staged) {
      return { status: 409, body: { ok: false, code: "connection_changed_during_authorization_probe" } };
    }
    return {
      status: sites.status === 429 ? 429 : 502,
      body: {
        ...sites,
        credentialStored: Boolean(reference),
        authorizationStage: "credential_stored_provider_probe_pending",
        recoveryOperation: "review_sites"
      }
    };
  }
  const saved = await saveSettings(
    sql,
    context,
    { ...connection, credential_reference: reference },
    {
      oauth_stage: "authorization_review_ready",
      granted_scopes: [READ_SCOPE],
      accessible_site_count: sites.sites.length,
      authorization_verified_at: new Date().toISOString()
    },
    "setup_required"
  );
  if (!saved) return { status: 409, body: { ok: false, code: "connection_changed_during_authorization" } };
  return {
    status: 200,
    body: {
      ok: true,
      operation: "complete_authorization",
      provider: PROVIDER,
      authorizationStage: "authorization_review_ready",
      credentialStored: true,
      grantedScopes: [READ_SCOPE],
      sites: sites.sites,
      providerSecretsReturned: false
    }
  };
}

async function reviewSites(
  sql: postgres.Sql,
  config: ReturnType<typeof environment>,
  context: Context,
  connection: Connection
) {
  if (connection.connection_status === "disabled") {
    return { status: 409, body: { ok: false, code: "connection_disabled" } };
  }
  if (!vaultId(connection.credential_reference)) {
    return { status: 409, body: { ok: false, code: "provider_refresh_credential_missing" } };
  }
  const access = await brokerAccess(sql, config, connection);
  if (!access.ok) return { status: access.status || 409, body: access };
  const sites = await listSites(access.accessToken);
  if (!sites.ok) return { status: sites.status || 502, body: sites };
  const saved = await saveSettings(
    sql,
    context,
    connection,
    {
      oauth_stage: "authorization_review_ready",
      granted_scopes: [READ_SCOPE],
      accessible_site_count: sites.sites.length,
      authorization_reviewed_at: new Date().toISOString()
    },
    "setup_required"
  );
  if (!saved) return { status: 409, body: { ok: false, code: "connection_changed_during_site_review" } };
  return {
    status: 200,
    body: {
      ok: true,
      operation: "review_sites",
      provider: PROVIDER,
      authorizationStage: "authorization_review_ready",
      sites: sites.sites,
      providerSecretsReturned: false
    }
  };
}

async function bindSite(
  sql: postgres.Sql,
  config: ReturnType<typeof environment>,
  context: Context,
  connection: Connection,
  payload: Record<string, unknown>
) {
  if (connection.connection_status === "disabled") {
    return { status: 409, body: { ok: false, code: "connection_disabled" } };
  }
  const siteUrl = text(payload.siteUrl);
  const canaryDate = text(payload.canaryDate);
  if (!validSite(siteUrl)) return { status: 400, body: { ok: false, code: "site_url_invalid" } };
  if (!validDay(canaryDate)) return { status: 400, body: { ok: false, code: "canary_date_invalid" } };
  const access = await brokerAccess(sql, config, connection);
  if (!access.ok) return { status: access.status || 409, body: access };
  const sites = await listSites(access.accessToken);
  if (!sites.ok) return { status: sites.status || 502, body: sites };
  const site = sites.sites.find((item) => item.siteUrl === siteUrl);
  if (!site) return { status: 403, body: { ok: false, code: "site_not_authorized_for_connection" } };
  const canary = await dailyReport(access.accessToken, siteUrl, canaryDate);
  if (!canary.ok) return { status: canary.status || 502, body: canary };
  const saved = await saveSettings(
    sql,
    context,
    connection,
    {
      oauth_stage: "provider_read_verified",
      granted_scopes: [READ_SCOPE],
      site_url: siteUrl,
      permission_level: site.permissionLevel,
      canary_date: canaryDate,
      canary_evidence_hash: canary.report.evidenceHash,
      bound_at: new Date().toISOString()
    },
    "connected"
  );
  if (!saved) return { status: 409, body: { ok: false, code: "connection_changed_during_site_binding" } };
  return {
    status: 200,
    body: {
      ok: true,
      operation: "bind_site",
      provider: PROVIDER,
      connectionStatus: "connected",
      site,
      canary: canary.report,
      providerSecretsReturned: false
    }
  };
}

async function readDaily(
  sql: postgres.Sql,
  config: ReturnType<typeof environment>,
  connection: Connection,
  payload: Record<string, unknown>
) {
  if (connection.connection_status !== "connected") {
    return { status: 409, body: { ok: false, code: "connection_not_verified" } };
  }
  const date = text(payload.date);
  if (!validDay(date)) return { status: 400, body: { ok: false, code: "date_invalid" } };
  const settings = providerSettings(connection);
  const siteUrl = text(settings.site_url);
  const granted = Array.isArray(settings.granted_scopes) ? settings.granted_scopes.map(text) : [];
  if (!validSite(siteUrl)) return { status: 409, body: { ok: false, code: "bound_site_missing" } };
  if (granted.length !== 1 || granted[0] !== READ_SCOPE) {
    return { status: 409, body: { ok: false, code: "stored_scope_contract_invalid" } };
  }
  const access = await brokerAccess(sql, config, connection);
  if (!access.ok) return { status: access.status || 409, body: access };
  const report = await dailyReport(access.accessToken, siteUrl, date);
  if (!report.ok) return { status: report.status || 502, body: report };
  return {
    status: 200,
    body: { ok: true, operation: "read_daily", report: report.report, providerSecretsReturned: false }
  };
}

async function disconnect(sql: postgres.Sql, context: Context, connection: Connection) {
  const id = vaultId(connection.credential_reference);
  if (!id) {
    const saved = await saveSettings(
      sql,
      context,
      connection,
      { oauth_stage: "revoked", revoked_at: new Date().toISOString() },
      "disabled"
    );
    if (!saved) return { status: 409, body: { ok: false, code: "connection_changed_during_disconnect" } };
    return {
      status: 200,
      body: {
        ok: true,
        operation: "disconnect",
        providerRevoked: false,
        localCredentialRevoked: true,
        alreadyWithoutCredential: true
      }
    };
  }
  const refreshToken = await resolveRefresh(sql, connection);
  if (!refreshToken) {
    return { status: 409, body: { ok: false, code: "provider_refresh_credential_missing" } };
  }
  const revoked = await providerFetch(REVOKE_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({ token: refreshToken }).toString()
  });
  if (!revoked.ok) return { status: revoked.status || 503, body: revoked };
  if (!revoked.response.ok) {
    return {
      status: 502,
      body: { ok: false, code: "provider_revoke_unverified", providerStatus: revoked.response.status }
    };
  }
  try {
    await sql.begin(async (tx) => {
      const removed = await tx.unsafe(
        "delete from vault.secrets where id=$1::uuid returning id",
        [id]
      );
      if (!removed[0]?.id) throw new Error("vault_secret_delete_failed");
      const root = connection.settings && typeof connection.settings === "object" ? connection.settings : {};
      const next = {
        ...root,
        google_search_console: {
          ...providerSettings(connection),
          oauth_stage: "revoked",
          revoked_at: new Date().toISOString()
        }
      };
      const updated = await tx.unsafe(
        "update public.business_integration_connections set credential_reference=null,settings=$1::jsonb,connection_status='disabled',last_checked_at=now(),updated_at=now() where id=$2::uuid and organization_id=$3::uuid and business_id=$4::uuid and provider_key=$5 and credential_reference=$6 returning id",
        [
          JSON.stringify(next),
          context.connectionId,
          context.organizationId,
          context.businessId,
          PROVIDER,
          connection.credential_reference
        ]
      );
      if (!updated[0]?.id) throw new Error("connection_cleanup_failed");
    });
  } catch {
    return {
      status: 503,
      body: {
        ok: false,
        code: "provider_revoked_local_credential_cleanup_failed",
        providerRevoked: true,
        localCredentialRevoked: false
      }
    };
  }
  return {
    status: 200,
    body: {
      ok: true,
      operation: "disconnect",
      providerRevoked: true,
      localCredentialRevoked: true,
      providerSecretsReturned: false
    }
  };
}

const brokerHandler = async (req: Request) => {
  let config: ReturnType<typeof environment>;
  try { config = environment(); }
  catch { return json(503, { ok: false, code: "provider_broker_setup_required" }); }

  if (req.method !== "POST") return json(405, { ok: false, code: "method_not_allowed" });
  if (req.headers.has("origin")) return json(403, { ok: false, code: "browser_origin_refused" });
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return json(415, { ok: false, code: "json_required" });
  }
  if (req.headers.has("authorization")) {
    return json(403, { ok: false, code: "authorization_header_refused" });
  }
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_REQUEST_BYTES) {
    return json(413, { ok: false, code: "request_too_large" });
  }
  let raw = "";
  try { raw = await req.text(); }
  catch { return json(400, { ok: false, code: "request_body_unreadable" }); }
  if (encoder.encode(raw).byteLength > MAX_REQUEST_BYTES) {
    return json(413, { ok: false, code: "request_too_large" });
  }
  const signatureOk = await validSignature(
    config.brokerSecret,
    text(req.headers.get("x-sonara-provider-broker-timestamp")),
    raw,
    text(req.headers.get("x-sonara-provider-broker-signature"))
  );
  if (!signatureOk) {
    return json(403, { ok: false, code: "provider_broker_signature_invalid" });
  }
  let input: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw);
    input = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return json(400, { ok: false, code: "request_json_invalid" });
  }
  if (input.version !== VERSION) return json(400, { ok: false, code: "broker_version_mismatch" });
  const operation = text(input.operation);
  if (!OPERATIONS.has(operation)) return json(400, { ok: false, code: "broker_operation_invalid" });
  let context: Context;
  try { context = parseContext(input.context); }
  catch (error) {
    return json(400, { ok: false, code: text((error as Error).message) || "context_invalid" });
  }
  const payload = input.payload && typeof input.payload === "object" && !Array.isArray(input.payload)
    ? input.payload as Record<string, unknown>
    : {};

  const sql = postgres(config.databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 5
  });
  try {
    const connection = await authorizedConnection(sql, context);
    if (!connection) return json(403, { ok: false, code: "provider_connection_not_authorized" });
    let result;
    if (operation === "complete_authorization") {
      result = await completeAuthorization(sql, config, context, connection, payload);
    } else if (operation === "review_sites") {
      result = await reviewSites(sql, config, context, connection);
    } else if (operation === "bind_site") {
      result = await bindSite(sql, config, context, connection, payload);
    } else if (operation === "read_daily") {
      result = await readDaily(sql, config, connection, payload);
    } else {
      result = await disconnect(sql, context, connection);
    }
    return json(result.status, result.body);
  } catch {
    return json(500, { ok: false, code: "provider_broker_internal_error" });
  } finally {
    await sql.end({ timeout: 1 }).catch(() => undefined);
  }
};

export default {
  fetch: withSupabase({ auth: "secret", cors: "disabled" }, brokerHandler)
};
