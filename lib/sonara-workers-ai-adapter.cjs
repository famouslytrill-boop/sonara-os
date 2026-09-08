"use strict";

// Cloudflare Workers AI -- inference with no server to run.
//
// Every other adapter in this family talks to something the owner runs
// themselves, which is why they all carry the loopback-on-serverless check.
// This one is the opposite case: a hosted API on a public hostname, reachable
// from a Vercel function with nothing tunnelled and nothing hosted. It uses the
// same base anyway, because the parts that matter -- placeholder rejection,
// bounded timeouts, a token that cannot reach a page, an error message that
// never carries the URL -- are not about where the service runs.
//
// ## What this is and is not
//
// It is a serverless inference path. It is not a licence question: no Cloudflare
// code ships here, and calling a hosted HTTP API is use of a service, not use of
// a work. What it *is* is a price. `CLAUDE.md` states the rule this falls under:
// a hosted service with a free tier is a price, not a licence, and a shipped
// feature resting on one stops working when the tier changes -- which is the
// vendor's decision, not this project's.
//
// So this obeys the same rule as the other six: off by default, never a
// dependency, and every caller keeps the deterministic path it already had. The
// record checks, the money figures and the chase drafts stay arithmetic over the
// owner's own rows whether or not this is configured.
//
// ## Why the model id is validated
//
// A Workers AI model id goes into the request path
// (`/accounts/{account}/ai/run/@cf/meta/llama-3.1-8b-instruct`), and a value
// that reaches a path can address a different endpoint on the same host with
// this server making the request. That is rule four in
// docs/architecture/EXTERNAL-SERVICES.md, and it is the same reason Langflow
// checks its flow id. A model of `../../user/tokens` is not a model.

const base = require("./sonara-service-adapter.cjs");

const LABEL = "Cloudflare Workers AI";
const PREFIX = "SONARA_WORKERS_AI";

const ENV_KEYS = base.envKeysFor(PREFIX, ["account", "model", "token"]);

// A Cloudflare account id is 32 hex characters. Pinned rather than "no slashes",
// because the account id is the first thing after /accounts/ and a loose check
// there is a path-traversal check that passes everything short of a slash.
const ACCOUNT_PATTERN = /^[0-9a-f]{32}$/i;

// `@cf/meta/llama-3.1-8b-instruct`, `@cf/baai/bge-base-en-v1.5`, and the
// hf-hosted `@hf/...` forms. Two to four slash-separated segments after the
// leading `@`, each starting alphanumeric. No dots as a whole segment, so `..`
// cannot appear.
const MODEL_PATTERN = /^@[a-z0-9]+(?:\/[a-z0-9][a-z0-9._-]*){1,3}$/i;

function getWorkersAiReadiness(options = {}) {
  const readiness = base.readinessFor({
    label: LABEL,
    prefix: PREFIX,
    required: ["account", "model"],
    secrets: ["token"],
    ...options
  });

  if (readiness.status !== "configured") return readiness;

  // Checked here rather than at call time, so a wrong value is a setup problem
  // the owner is told about on the readiness page, not a 404 during somebody's
  // request. The account id is reported back as configuration, not as a secret:
  // it appears in every Cloudflare dashboard URL and is not a credential.
  if (!ACCOUNT_PATTERN.test(readiness.account)) {
    return {
      ok: false,
      enabled: true,
      status: "setup_required",
      keys: ENV_KEYS,
      host: readiness.host,
      detail: `${ENV_KEYS.account} is not a Cloudflare account id (32 hex characters).`
    };
  }

  if (!MODEL_PATTERN.test(readiness.model)) {
    return {
      ok: false,
      enabled: true,
      status: "setup_required",
      keys: ENV_KEYS,
      host: readiness.host,
      detail: `${ENV_KEYS.model} is not a Workers AI model id, which looks like @cf/meta/llama-3.1-8b-instruct.`
    };
  }

  return readiness;
}

/**
 * Run one inference and return the text.
 *
 * `messages` is a chat array in the shape every OpenAI-compatible runtime uses:
 * `[{ role, content }]`. It is passed as given and never merged with anything
 * from this server -- no system prompt is injected here, because a caller that
 * cannot see the whole prompt cannot reason about what the model was asked.
 *
 * Returns { ok: true, text } or { ok: false, code, detail } and never throws.
 */
async function generate(messages, { readiness = getWorkersAiReadiness(), fetchImpl = fetch, maxTokens = 512 } = {}) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { ok: false, code: "invalid_messages", detail: "Inference needs a non-empty array of { role, content } messages." };
  }

  for (const message of messages) {
    if (!message || typeof message.role !== "string" || typeof message.content !== "string") {
      return { ok: false, code: "invalid_messages", detail: "Every message needs a string role and string content." };
    }
  }

  // The readiness object is the only source of the account and model, so a
  // caller cannot pass a path segment in. Re-validated rather than trusted,
  // because a caller may construct a readiness object itself -- the tests do.
  if (!ACCOUNT_PATTERN.test(String(readiness.account || "")) || !MODEL_PATTERN.test(String(readiness.model || ""))) {
    return { ok: false, code: "setup_required", detail: `${ENV_KEYS.account} or ${ENV_KEYS.model} is not a usable value.` };
  }

  const called = await base.postJson(
    readiness,
    `/accounts/${readiness.account}/ai/run/${readiness.model}`,
    { messages, max_tokens: Math.min(Math.max(Number(maxTokens) || 512, 1), 4096) },
    { fetchImpl, headers: readiness.token ? { Authorization: `Bearer ${readiness.token}` } : {} }
  );
  if (!called.ok) return called;

  // Cloudflare reports a refused run inside a 200 with `success: false`, the
  // same shape Dify uses. Reading the status rather than inferring it from the
  // HTTP code is the difference between an error and a silently empty answer.
  if (called.data?.success === false) {
    const first = Array.isArray(called.data.errors) ? called.data.errors[0] : undefined;
    // The provider's message is reported because it is about the request, not
    // about the configuration -- it names a model or a quota, never the URL.
    return { ok: false, code: "provider_refused", detail: first?.message ? String(first.message).slice(0, 200) : "Workers AI refused the request." };
  }

  const text = called.data?.result?.response;
  if (typeof text !== "string" || !text.trim()) {
    return { ok: false, code: "empty_response", detail: "Workers AI answered without any text." };
  }

  return { ok: true, text };
}

module.exports = { ENV_KEYS, getWorkersAiReadiness, generate, ACCOUNT_PATTERN, MODEL_PATTERN };
