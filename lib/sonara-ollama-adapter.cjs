"use strict";

// A server-side adapter that actually calls a model.
//
// Until this, nothing in this product called one. `lib/optional-ai-gateway.cjs`
// says so in its own first line -- "This is a readiness DETECTOR only. It never
// makes network calls." Every "AI" surface here was arithmetic over the owner's
// own rows, which was honest and is why the chase drafts and the record checks
// can be trusted. It was also the reason the register had 66 reviewed
// repositories and no way to say any of them was in use.
//
// Ollama is the right first one. MIT, so nothing is owed but attribution. It
// runs on hardware somebody already owns, so a call costs nothing per token --
// which is the requirement, not a preference. And it needs no key, so there is
// no secret to leak.
//
// AGENTS.md: "Use Provider Gateway or approved server-side provider adapters
// for AI calls." This is the second kind. It is server-only; nothing about it
// reaches the browser.
//
// ## The constraint that actually breaks this, stated first
//
// This application is deployed to Vercel as serverless functions. An Ollama
// running on the owner's laptop is **not reachable from there** -- not behind a
// firewall, not on localhost, not on a home network. `http://localhost:11434`
// configured in production resolves to the serverless container itself, where
// nothing is listening.
//
// So this is genuinely useful in two situations and misleading in a third:
//
//   * a self-hosted deployment where the server and Ollama share a network
//   * a reachable host the owner runs deliberately, with its own protection
//   * NOT an owner's laptop while the app runs on Vercel -- and the readiness
//     check says so by name rather than letting somebody discover it as a
//     timeout in production
//
// ## What it will not do
//
// It does not enable itself. Absent configuration it reports setup-required and
// every caller falls back to the deterministic path it already had. A model
// being unavailable must never be the difference between a page working and a
// page failing.
//
// It does not send anything to a third party. A local runtime is the point; if
// the configured host is not local that is the owner's deliberate choice, and
// the readiness report names the host so the choice is visible.
//
// It has no default timeout of "however long the model takes". A generation
// that hangs holds a serverless invocation open until the platform kills it,
// which reads to a customer as the page being broken.

const DEFAULT_TIMEOUT_MS = 20000;
const MAX_TIMEOUT_MS = 60000;

const ENV_KEYS = Object.freeze({
  enabled: "SONARA_OLLAMA_ENABLED",
  baseUrl: "SONARA_OLLAMA_URL",
  model: "SONARA_OLLAMA_MODEL",
  timeout: "SONARA_OLLAMA_TIMEOUT_MS"
});

const PLACEHOLDER = /^(your[-_]|changeme|placeholder|example|xxx+|todo)/i;

// Hosts that cannot be reached from a serverless deployment. Named rather than
// pattern-matched loosely, because "127.0.0.1" and "::1" are the two somebody
// actually types.
const LOOPBACK_HOSTS = Object.freeze(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);

function readEnv(name) {
  return String(process.env[name] || "").trim();
}

function parseTimeout(raw) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.min(Math.round(value), MAX_TIMEOUT_MS);
}

/**
 * Whether this is configured, and if not, precisely what is missing.
 *
 * Never returns the configured URL as a whole -- only its host -- so a base URL
 * carrying a token in its query string cannot be rendered onto a page.
 */
function getOllamaReadiness({ isServerless = Boolean(process.env.VERCEL) } = {}) {
  const enabled = readEnv(ENV_KEYS.enabled).toLowerCase();
  const baseUrl = readEnv(ENV_KEYS.baseUrl);
  const model = readEnv(ENV_KEYS.model);

  if (enabled !== "true") {
    return {
      ok: true,
      enabled: false,
      status: "disabled",
      detail: `Local model calls are off. Set ${ENV_KEYS.enabled}=true to turn them on.`
    };
  }

  if (!baseUrl || PLACEHOLDER.test(baseUrl)) {
    return { ok: false, enabled: true, status: "setup_required", detail: `${ENV_KEYS.baseUrl} is not set to a real address.` };
  }

  let host;
  try {
    host = new URL(baseUrl).hostname;
  } catch {
    return { ok: false, enabled: true, status: "setup_required", detail: `${ENV_KEYS.baseUrl} is not a valid URL.` };
  }

  // The failure this exists to prevent: configured, plausible, and silently
  // unreachable from where the code actually runs.
  if (isServerless && LOOPBACK_HOSTS.includes(host.toLowerCase())) {
    return {
      ok: false,
      enabled: true,
      status: "unreachable_from_serverless",
      host,
      detail:
        `${ENV_KEYS.baseUrl} points at ${host}, which on a serverless deployment means the function's own container, ` +
        "not your machine. Point it at a host this server can reach, or run the application somewhere that shares a network with Ollama."
    };
  }

  if (!model || PLACEHOLDER.test(model)) {
    return { ok: false, enabled: true, status: "setup_required", host, detail: `${ENV_KEYS.model} is not set to a model name.` };
  }

  return {
    ok: true,
    enabled: true,
    status: "configured",
    host,
    model,
    timeoutMs: parseTimeout(readEnv(ENV_KEYS.timeout)),
    detail: `Configured to call ${model} at ${host}.`
  };
}

/**
 * Ask the model for text.
 *
 * Returns { ok: true, text } or { ok: false, code, detail } and never throws.
 * A caller that has a deterministic answer already must prefer it when this
 * returns ok: false -- the point is added range, never a dependency.
 */
async function generate(prompt, { readiness = getOllamaReadiness(), fetchImpl = fetch } = {}) {
  if (!readiness?.enabled) return { ok: false, code: "disabled", detail: readiness?.detail || "Local model calls are off." };
  if (readiness.status !== "configured") return { ok: false, code: readiness.status, detail: readiness.detail };

  const text = String(prompt == null ? "" : prompt).trim();
  if (!text) return { ok: false, code: "empty_prompt", detail: "Nothing was asked." };

  // An abort rather than a bare await. Without it a stalled model holds the
  // invocation until the platform kills it, and the customer sees a dead page
  // rather than a fallback.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), readiness.timeoutMs || DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetchImpl(`${readEnv(ENV_KEYS.baseUrl).replace(/\/+$/, "")}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: readiness.model, prompt: text, stream: false }),
      signal: controller.signal
    });
    // Deliberately no .catch() here. It was there, and it swallowed the abort
    // before the handler below could see it -- a timeout was reported as
    // "unreachable", which sends somebody to check the network for a model that
    // was answering slowly. The try/catch distinguishes the three cases:
    // aborted, threw, and answered with an error status.

    if (!response?.ok) {
      return { ok: false, code: "unreachable", detail: `The model host did not answer (${response?.status || "no response"}).` };
    }

    const payload = await response.json().catch(() => null);
    const answer = String(payload?.response || "").trim();
    if (!answer) return { ok: false, code: "empty_response", detail: "The model returned nothing." };

    return { ok: true, text: answer, model: readiness.model };
  } catch (error) {
    // Includes the abort. The message is not passed through: an error from a
    // fetch carries the URL it failed on, and that URL is configuration.
    return {
      ok: false,
      code: error?.name === "AbortError" ? "timed_out" : "failed",
      detail: error?.name === "AbortError"
        ? `The model did not answer within ${readiness.timeoutMs || DEFAULT_TIMEOUT_MS}ms.`
        : "The call to the model host failed."
    };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { ENV_KEYS, DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS, LOOPBACK_HOSTS, getOllamaReadiness, generate };
