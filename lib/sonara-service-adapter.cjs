"use strict";

// The contract every external service adapter shares.
//
// `lib/sonara-ollama-adapter.cjs` was written first and carried all of this
// inline: environment naming, placeholder detection, URL validation, the
// loopback-on-serverless check, timeout bounds, host-only reporting, and the
// rule that a fetch error message is never passed through because it contains
// the configured URL. Four adapters copying that is four chances for one of
// them to be subtly less careful, and the one that is would be the one nobody
// re-read.
//
// So readiness lives here once, and each adapter owns only its own call shape,
// which is the part that genuinely differs.
//
// ## Why every adapter needs the same reachability check
//
// This application deploys as Vercel serverless functions. Every service in
// this family -- a model runtime, a flow builder, a crawler -- is something an
// owner runs themselves, which means the default place they run it is their own
// machine, which is the one place the serverless function cannot reach.
// `http://localhost:11434` in production resolves to the function's own
// container, where nothing is listening.
//
// That is not a bug to fix in each adapter. It is a property of the deployment,
// and the honest response is to name it at configuration time rather than let
// it arrive as a timeout. `docs/architecture/EXTERNAL-SERVICES.md` covers the
// three ways to make a local service reachable.
//
// ## What an adapter may never do
//
// Depend on the service being up. Every caller must have a deterministic path
// it falls back to. A service being unreachable must never be the difference
// between a page working and a page failing -- which is also why none of these
// are enabled by default.

const DEFAULT_TIMEOUT_MS = 20000;
const MAX_TIMEOUT_MS = 60000;

const PLACEHOLDER = /^(your[-_]|changeme|placeholder|example|xxx+|todo)/i;

// Named rather than pattern-matched, because these are the strings somebody
// actually types into an environment variable.
const LOOPBACK_HOSTS = Object.freeze(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);

function readEnv(name) {
  return String(process.env[name] || "").trim();
}

function envKeysFor(prefix, extra = []) {
  const keys = {
    enabled: `${prefix}_ENABLED`,
    baseUrl: `${prefix}_URL`,
    timeout: `${prefix}_TIMEOUT_MS`
  };
  for (const name of extra) keys[name] = `${prefix}_${name.toUpperCase()}`;
  return Object.freeze(keys);
}

function boundTimeout(raw) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.min(Math.round(value), MAX_TIMEOUT_MS);
}

/**
 * Whether a service is configured, and if not, precisely what is missing.
 *
 * Returns the host and never the full URL. A base URL can carry a token in its
 * query string, and readiness is rendered onto a page.
 */
// `required` values appear on the readiness object. `secrets` are required too,
// and are carried non-enumerably instead -- an API key must never reach a page,
// a log line or a JSON.stringify.
//
// Open WebUI did this by hand: satisfy the required check, delete the property,
// redefine it. Three adapters needed a key before that pattern was copied twice
// more, and a hand-rolled deletion is one somebody forgets. Now it is a
// declaration, and forgetting means the key is not read at all.
function readinessFor({ label, prefix, required = [], secrets = [], isServerless = Boolean(process.env.VERCEL) } = {}) {
  const keys = envKeysFor(prefix, [...required, ...secrets]);
  const enabled = readEnv(keys.enabled).toLowerCase();
  const baseUrl = readEnv(keys.baseUrl);

  if (enabled !== "true") {
    return { ok: true, enabled: false, status: "disabled", keys, detail: `${label} is off. Set ${keys.enabled}=true to turn it on.` };
  }

  if (!baseUrl || PLACEHOLDER.test(baseUrl)) {
    return { ok: false, enabled: true, status: "setup_required", keys, detail: `${keys.baseUrl} is not set to a real address.` };
  }

  let host;
  try {
    host = new URL(baseUrl).hostname;
  } catch {
    return { ok: false, enabled: true, status: "setup_required", keys, detail: `${keys.baseUrl} is not a valid URL.` };
  }

  if (isServerless && LOOPBACK_HOSTS.includes(host.toLowerCase())) {
    return {
      ok: false,
      enabled: true,
      status: "unreachable_from_serverless",
      keys,
      host,
      detail:
        `${keys.baseUrl} points at ${host}, which on a serverless deployment means the function's own container, not your machine. ` +
        "See docs/architecture/EXTERNAL-SERVICES.md for the three ways to make a local service reachable."
    };
  }

  const values = {};
  const hidden = {};
  for (const name of [...required, ...secrets]) {
    const value = readEnv(keys[name]);
    if (!value || PLACEHOLDER.test(value)) {
      return { ok: false, enabled: true, status: "setup_required", keys, host, detail: `${keys[name]} is not set.` };
    }
    if (secrets.includes(name)) hidden[name] = value;
    else values[name] = value;
  }

  const readiness = {
    ok: true,
    enabled: true,
    status: "configured",
    keys,
    host,
    timeoutMs: boundTimeout(readEnv(keys.timeout)),
    detail: `${label} is configured at ${host}.`,
    ...values
  };

  // The full URL is carried non-enumerably, so postJson can read it and
  // JSON.stringify cannot. It was an ordinary property for one commit, and the
  // Ollama test caught it immediately: a base URL can carry a token in its
  // query string or path, and readiness objects get rendered onto a page. Host
  // is safe to show; the URL is configuration.
  Object.defineProperty(readiness, "baseUrl", {
    value: baseUrl.replace(/\/+$/, ""),
    enumerable: false,
    writable: false
  });

  for (const [name, value] of Object.entries(hidden)) {
    Object.defineProperty(readiness, name, { value, enumerable: false, writable: false });
  }

  return readiness;
}

/**
 * POST JSON to a configured service and read JSON back.
 *
 * Returns { ok: true, data } or { ok: false, code, detail } and never throws.
 *
 * Three failure codes rather than one, because they send somebody to different
 * places: `timed_out` means the service answered too slowly, `unreachable`
 * means it answered with an error status, and `failed` means the call itself
 * threw. The first version of the Ollama adapter caught the fetch inline, which
 * collapsed the abort into `unreachable` and sent people to check a network for
 * a service that was merely slow.
 */
async function postJson(readiness, path, body, { fetchImpl = fetch, headers = {} } = {}) {
  if (!readiness?.enabled) return { ok: false, code: "disabled", detail: readiness?.detail || "This service is off." };
  if (readiness.status !== "configured") return { ok: false, code: readiness.status, detail: readiness.detail };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), readiness.timeoutMs || DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetchImpl(`${readiness.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!response?.ok) {
      return { ok: false, code: "unreachable", detail: `The service did not answer (${response?.status || "no response"}).` };
    }

    const data = await response.json().catch(() => null);
    if (data === null) return { ok: false, code: "unreadable_response", detail: "The service answered with something that is not JSON." };
    return { ok: true, data };
  } catch (error) {
    // The message is never passed through: an error from a fetch carries the
    // URL it failed on, and that URL is configuration.
    return {
      ok: false,
      code: error?.name === "AbortError" ? "timed_out" : "failed",
      detail: error?.name === "AbortError"
        ? `The service did not answer within ${readiness.timeoutMs || DEFAULT_TIMEOUT_MS}ms.`
        : "The call to the service failed."
    };
  } finally {
    clearTimeout(timer);
  }
}

// --- fetching something somebody supplied ------------------------------------
//
// Two adapters now make this server fetch a URL a person typed: Crawl4AI reads
// a page, and Whisper transcribes an audio asset. That turns this server into a
// request forwarder if the target is not checked, with its own network position
// behind the request -- a URL pointing at a cloud metadata endpoint or at a
// private address on the same network is a server-side request forgery.
//
// The check lives here rather than in either adapter, because two copies of a
// security check drift and only one of them gets the next fix. It moved out of
// `sonara-crawl4ai-adapter.cjs`, which still re-exports it under its old name.

// Literal addresses that must never be fetched: loopback, link-local, cloud
// metadata, and the three private IPv4 ranges.
const FORBIDDEN_HOST = /^(localhost|127\.|0\.0\.0\.0$|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$|\[?fe80:|\[?fc00:|\[?fd)/i;

/**
 * Whether a URL this server would fetch is allowed, and why not if it is not.
 *
 * Returns null when it is allowed, so a caller reads `if (reason) refuse`.
 *
 * The limit worth stating: this reads the URL as written. A public hostname
 * that **resolves** to a private address is the case it cannot see, and that
 * needs the service itself to be network-isolated.
 */
function reasonNotFetchable(target) {
  let url;
  try {
    url = new URL(String(target || ""));
  } catch {
    return "That is not a valid web address.";
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return `Only http and https addresses can be fetched, not ${url.protocol.replace(":", "")}.`;
  }

  // A URL carrying credentials would send them from this server.
  if (url.username || url.password) return "That address carries a username or password, which this will not send.";

  if (FORBIDDEN_HOST.test(url.hostname)) {
    return "That address is on a private or loopback network. This server will not fetch it, because doing so would use its own network position on someone else's behalf.";
  }

  return null;
}

/**
 * Build a multipart/form-data body without a dependency.
 *
 * `fields` values are either a string or `{ filename, contentType, bytes }`.
 * The boundary is random rather than fixed: a fixed boundary appearing inside
 * an uploaded file would split the body in the wrong place, and an audio file
 * is exactly the kind of payload that can contain any byte sequence.
 */
function multipartBody(fields) {
  const boundary = `----sonara${require("node:crypto").randomBytes(16).toString("hex")}`;
  const parts = [];
  for (const [name, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "object" && value.bytes) {
      parts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${value.filename || "file"}"\r\n`
        + `Content-Type: ${value.contentType || "application/octet-stream"}\r\n\r\n`, "utf8"));
      parts.push(Buffer.isBuffer(value.bytes) ? value.bytes : Buffer.from(value.bytes));
      parts.push(Buffer.from("\r\n", "utf8"));
    } else {
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`, "utf8"));
    }
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`, "utf8"));
  return { boundary, body: Buffer.concat(parts) };
}

/**
 * POST a multipart body to a configured service and read JSON back.
 *
 * The same three failure codes as `postJson`, and the same rule about never
 * passing a fetch error message through, because it carries the configured URL.
 */
async function postMultipart(readiness, path, fields, { fetchImpl = fetch } = {}) {
  if (!readiness?.enabled) return { ok: false, code: "disabled", detail: readiness?.detail || "This service is off." };
  if (readiness.status !== "configured") return { ok: false, code: readiness.status, detail: readiness.detail };

  const { boundary, body } = multipartBody(fields);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), readiness.timeoutMs || DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetchImpl(`${readiness.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
      body,
      signal: controller.signal
    });
    if (!response?.ok) {
      return { ok: false, code: "unreachable", detail: `The service did not answer (${response?.status || "no response"}).` };
    }
    const data = await response.json().catch(() => null);
    if (data === null) return { ok: false, code: "unreadable_response", detail: "The service answered with something that is not JSON." };
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      code: error?.name === "AbortError" ? "timed_out" : "failed",
      detail: error?.name === "AbortError"
        ? `The service did not answer within ${readiness.timeoutMs || DEFAULT_TIMEOUT_MS}ms.`
        : "The call to the service failed."
    };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS, LOOPBACK_HOSTS, PLACEHOLDER, FORBIDDEN_HOST, envKeysFor, boundTimeout, readinessFor, postJson, postMultipart, multipartBody, reasonNotFetchable };
