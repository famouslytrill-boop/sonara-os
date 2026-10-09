// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const crypto = require("node:crypto");

const BROKER_FUNCTION = "google-search-console-broker";
const BROKER_TIMEOUT_MS = 15_000;
const BROKER_SIGNATURE_VERSION = "v1";
const BROKER_MAX_CLOCK_SKEW_SECONDS = 120;
const MAX_REQUEST_BYTES = 32 * 1024;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OPERATIONS = Object.freeze([
  "complete_authorization",
  "review_sites",
  "bind_site",
  "read_daily",
  "disconnect"
]);
const SECRET_KEY = /(?:^|_)(?:access_?token|refresh_?token|client_?secret|authorization|password|private_?key|secret)(?:$|_)/i;

function text(value) {
  return String(value == null ? "" : value).trim();
}

function uuid(value, field) {
  const out = text(value);
  if (!UUID.test(out)) throw new TypeError(`${field} must be a UUID`);
  return out;
}

function exactHttpsOrigin(value) {
  let url;
  try { url = new URL(text(value)); }
  catch { throw new TypeError("Supabase URL must be an absolute URL"); }
  if (url.protocol !== "https:" || url.username || url.password || url.hash || url.pathname !== "/" || url.search) {
    throw new TypeError("Supabase URL must be an HTTPS origin");
  }
  return url.origin;
}

function brokerContext(input = {}) {
  return Object.freeze({
    organizationId: uuid(input.organizationId, "organizationId"),
    businessId: uuid(input.businessId, "businessId"),
    userId: uuid(input.userId, "userId"),
    connectionId: uuid(input.connectionId, "connectionId")
  });
}

function operationName(value) {
  const op = text(value);
  if (!OPERATIONS.includes(op)) throw new TypeError(`operation must be one of: ${OPERATIONS.join(", ")}`);
  return op;
}

function brokerSecret(value) {
  const out = text(value);
  if (Buffer.byteLength(out, "utf8") < 32) {
    throw new TypeError("provider broker token must contain at least 32 bytes");
  }
  return out;
}

function brokerRequestPath() {
  return `/functions/v1/${BROKER_FUNCTION}`;
}

function brokerRequestSignature({ timestamp, body, brokerToken }) {
  const canonical = [String(timestamp), "POST", brokerRequestPath(), String(body)].join("\n");
  return `${BROKER_SIGNATURE_VERSION}=${crypto.createHmac("sha256", brokerSecret(brokerToken))
    .update(canonical, "utf8")
    .digest("base64url")}`;
}

function assertSafePayload(value, path = "payload") {
  if (value == null) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafePayload(item, `${path}[${index}]`));
    return;
  }
  if (typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    if (SECRET_KEY.test(key)) {
      throw new TypeError(`${path}.${key} is raw secret material and cannot cross the broker client boundary`);
    }
    assertSafePayload(nested, `${path}.${key}`);
  }
}

function safeJsonBytes(value, maximum, label) {
  const raw = JSON.stringify(value);
  const bytes = Buffer.byteLength(raw, "utf8");
  if (bytes > maximum) throw new RangeError(`${label} exceeds ${maximum} bytes`);
  return { raw, bytes };
}

function responseContainsSecretKey(value) {
  if (value == null) return false;
  if (Array.isArray(value)) return value.some(responseContainsSecretKey);
  if (typeof value !== "object") return false;
  return Object.entries(value).some(([key, nested]) => SECRET_KEY.test(key) || responseContainsSecretKey(nested));
}

function sanitizeBrokerError(status, body) {
  const code = text(body?.code) || (status >= 500 ? "provider_broker_unavailable" : "provider_broker_rejected");
  const retryMode = body?.retryMode === "durable_deferred" ? "durable_deferred" : "none";
  const retryAfterSeconds = Number(body?.retryAfterSeconds);
  return Object.freeze({
    ok: false,
    code,
    status,
    retryMode,
    retryAfterSeconds: Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      ? Math.min(86_400, Math.ceil(retryAfterSeconds))
      : null
  });
}

async function invokeGoogleSearchConsoleBroker({
  operation,
  context,
  payload = {},
  getSupabaseServerConfig,
  getSupabaseSecretKey,
  getBrokerToken,
  fetchImpl = globalThis.fetch,
  nowImpl = Date.now
} = {}) {
  const op = operationName(operation);
  const ctx = brokerContext(context);
  assertSafePayload(payload);

  const config = typeof getSupabaseServerConfig === "function"
    ? getSupabaseServerConfig()
    : { ok: false };
  const serverApiKey = text(
    typeof getSupabaseSecretKey === "function" ? getSupabaseSecretKey() : config?.secretKey
  );
  if (!config?.ok || !text(config.url) || !serverApiKey || !serverApiKey.startsWith("sb_secret_")) {
    return Object.freeze({ ok: false, code: "provider_broker_supabase_not_configured", status: 503 });
  }
  let origin;
  try { origin = exactHttpsOrigin(config.url); }
  catch {
    return Object.freeze({ ok: false, code: "provider_broker_supabase_url_invalid", status: 503 });
  }

  let dedicatedBrokerToken;
  try {
    dedicatedBrokerToken = brokerSecret(
      typeof getBrokerToken === "function" ? getBrokerToken() : ""
    );
  } catch {
    return Object.freeze({ ok: false, code: "provider_broker_token_not_configured", status: 503 });
  }
  if (typeof fetchImpl !== "function") {
    return Object.freeze({ ok: false, code: "provider_broker_fetch_unavailable", status: 503 });
  }

  const requestBody = {
    version: "1.0.0",
    operation: op,
    context: ctx,
    payload
  };
  let encoded;
  try { encoded = safeJsonBytes(requestBody, MAX_REQUEST_BYTES, "provider broker request"); }
  catch {
    return Object.freeze({ ok: false, code: "provider_broker_request_too_large", status: 413 });
  }

  const nowMs = Number(typeof nowImpl === "function" ? nowImpl() : NaN);
  if (!Number.isFinite(nowMs) || nowMs <= 0) {
    return Object.freeze({ ok: false, code: "provider_broker_clock_unavailable", status: 503 });
  }
  const timestamp = String(Math.floor(nowMs / 1000));
  const signature = brokerRequestSignature({
    timestamp,
    body: encoded.raw,
    brokerToken: dedicatedBrokerToken
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BROKER_TIMEOUT_MS);
  let response;
  try {
    response = await fetchImpl(`${origin}${brokerRequestPath()}`, {
      method: "POST",
      headers: {
        apikey: serverApiKey,
        "x-sonara-provider-broker-timestamp": timestamp,
        "x-sonara-provider-broker-signature": signature,
        "content-type": "application/json",
        accept: "application/json"
      },
      body: encoded.raw,
      redirect: "error",
      signal: controller.signal
    });
  } catch {
    return Object.freeze({
      ok: false,
      code: "provider_broker_network_error",
      status: 503,
      retryMode: op === "read_daily" || op === "review_sites" ? "durable_deferred" : "none",
      retryAfterSeconds: op === "read_daily" || op === "review_sites" ? 60 : null
    });
  } finally {
    clearTimeout(timeout);
  }

  const declaredLength = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    return Object.freeze({ ok: false, code: "provider_broker_response_too_large", status: 502 });
  }
  const raw = await response.text().catch(() => "");
  if (Buffer.byteLength(raw, "utf8") > MAX_RESPONSE_BYTES) {
    return Object.freeze({ ok: false, code: "provider_broker_response_too_large", status: 502 });
  }

  let body = {};
  if (raw) {
    try { body = JSON.parse(raw); }
    catch {
      return Object.freeze({ ok: false, code: "provider_broker_response_invalid", status: 502 });
    }
  }
  if (responseContainsSecretKey(body)) {
    return Object.freeze({ ok: false, code: "provider_broker_secret_leak_detected", status: 502 });
  }
  if (!response.ok || body?.ok !== true) {
    return sanitizeBrokerError(response.status, body);
  }

  return Object.freeze({
    ...body,
    ok: true,
    brokerFunction: BROKER_FUNCTION,
    providerSecretsReturned: false
  });
}

function getProviderBrokerClientContract() {
  return Object.freeze({
    functionName: BROKER_FUNCTION,
    transport: "supabase_edge_function",
    auth: Object.freeze({
      apiKey: "supabase_secret_key_required",
      platformJwtVerification: false,
      requestHmac: BROKER_SIGNATURE_VERSION,
      sharedSecretTransmitted: false,
      maximumClockSkewSeconds: BROKER_MAX_CLOCK_SKEW_SECONDS,
      browserCallable: false
    }),
    retries: Object.freeze({
      complete_authorization: "never_automatic",
      review_sites: "safe_to_retry_after_deferred_failure",
      bind_site: "never_automatic",
      read_daily: "durable_external_scheduler_only",
      disconnect: "never_automatic"
    }),
    responsePolicy: "reject_secret_shaped_keys",
    rawProviderSecretInputAllowed: false,
    timeoutMs: BROKER_TIMEOUT_MS,
    productionEnabled: false
  });
}

module.exports = {
  BROKER_FUNCTION,
  BROKER_TIMEOUT_MS,
  BROKER_SIGNATURE_VERSION,
  BROKER_MAX_CLOCK_SKEW_SECONDS,
  MAX_REQUEST_BYTES,
  MAX_RESPONSE_BYTES,
  OPERATIONS,
  brokerContext,
  brokerRequestSignature,
  responseContainsSecretKey,
  invokeGoogleSearchConsoleBroker,
  getProviderBrokerClientContract
};
