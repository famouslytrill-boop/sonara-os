"use strict";

// OpenAI Responses API provider for explicit owner/admin drafting.
//
// This module deliberately does NOT provide an arbitrary base URL. The
// OPENAI_API_KEY is a production credential and must only be sent to OpenAI's
// official API host. If SONARA needs an OpenAI-compatible local gateway, that
// belongs behind one of the separately governed gateway adapters instead.
//
// No customer request depends on this provider. Missing credentials are a
// setup state, not a launch failure, and callers must retain their deterministic
// path. Calls are server-side only and opt-in at the route/action level.

const { boundTimeout, DEFAULT_TIMEOUT_MS } = require("./sonara-service-adapter.cjs");

const PROVIDER = "openai";
const LABEL = "OpenAI / ChatGPT";
const ENDPOINT = "https://api.openai.com/v1/responses";
const HOST = "api.openai.com";
const DEFAULT_MODEL = "gpt-5.6-luna";
const MAX_OUTPUT_TOKENS = 4096;
const MODEL_PATTERN = /^[a-z0-9][a-z0-9._:-]{1,127}$/i;
const PLACEHOLDER = /^(your[-_]|changeme|placeholder|example|xxx+|todo)/i;

function runtimeEnv(overrides) {
  if (overrides) return overrides;
  // Keep these literal process.env reads. scripts/verify-env.mjs intentionally
  // scans that shape so adding/removing provider configuration cannot become an
  // invisible environment contract.
  return {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    SONARA_OPENAI_MODEL: process.env.SONARA_OPENAI_MODEL,
    SONARA_PROVIDER_TIMEOUT_MS: process.env.SONARA_PROVIDER_TIMEOUT_MS
  };
}

function readEnv(env, key) {
  return String(env?.[key] || "").trim();
}

function timeoutFor(env) {
  return boundTimeout(readEnv(env, "SONARA_PROVIDER_TIMEOUT_MS")) || DEFAULT_TIMEOUT_MS;
}

function getOpenAIReadiness(options = {}) {
  const env = runtimeEnv(options.env);
  const model = readEnv(env, "SONARA_OPENAI_MODEL") || DEFAULT_MODEL;
  const apiKey = readEnv(env, "OPENAI_API_KEY");

  if (!MODEL_PATTERN.test(model)) {
    return {
      ok: false,
      enabled: false,
      status: "setup_required",
      provider: PROVIDER,
      label: LABEL,
      host: HOST,
      model,
      detail: "SONARA_OPENAI_MODEL is not a valid model identifier."
    };
  }

  if (!apiKey || PLACEHOLDER.test(apiKey)) {
    return {
      ok: true,
      enabled: false,
      status: "disabled",
      provider: PROVIDER,
      label: LABEL,
      host: HOST,
      model,
      timeoutMs: timeoutFor(env),
      detail: "OPENAI_API_KEY is not configured. OpenAI drafting stays off."
    };
  }

  const readiness = {
    ok: true,
    enabled: true,
    status: "configured",
    provider: PROVIDER,
    label: LABEL,
    host: HOST,
    model,
    timeoutMs: timeoutFor(env),
    detail: `OpenAI is configured for ${model}.`
  };

  Object.defineProperty(readiness, "apiKey", {
    value: apiKey,
    enumerable: false,
    writable: false
  });

  return readiness;
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return null;
  const normalized = [];
  for (const message of messages) {
    const role = String(message?.role || "").trim();
    const content = String(message?.content || "").trim();
    if (!content || !["system", "developer", "user", "assistant"].includes(role)) return null;
    normalized.push({ role, content });
  }
  return normalized;
}

function extractText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
  const pieces = [];
  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    for (const part of Array.isArray(item?.content) ? item.content : []) {
      if ((part?.type === "output_text" || part?.type === "text") && typeof part?.text === "string" && part.text.trim()) {
        pieces.push(part.text.trim());
      }
    }
  }
  return pieces.join("\n").trim();
}

async function generate(messages, options = {}) {
  const readiness = options.readiness || getOpenAIReadiness(options);
  const input = normalizeMessages(messages);
  if (!input) {
    return { ok: false, code: "invalid_messages", detail: "OpenAI drafting needs a non-empty array of system/developer/user/assistant messages." };
  }
  if (!readiness?.enabled || readiness.status !== "configured" || !readiness.apiKey) {
    return { ok: false, code: "setup_required", detail: readiness?.detail || "OpenAI is not configured." };
  }
  if (!MODEL_PATTERN.test(String(readiness.model || ""))) {
    return { ok: false, code: "setup_required", detail: "The configured OpenAI model is not valid." };
  }

  const maxTokens = Math.min(Math.max(Number(options.maxTokens) || 700, 1), MAX_OUTPUT_TOKENS);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const timeoutMs = readiness.timeoutMs || DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${readiness.apiKey}`
      },
      body: JSON.stringify({
        model: readiness.model,
        input,
        max_output_tokens: maxTokens,
        store: false
      }),
      signal: controller.signal
    });

    if (!response?.ok) {
      return { ok: false, code: "provider_refused", detail: `OpenAI did not accept the request (${response?.status || "no response"}).` };
    }

    const payload = await response.json().catch(() => null);
    if (!payload) return { ok: false, code: "unreadable_response", detail: "OpenAI returned a response SONARA could not read." };
    const text = extractText(payload);
    if (!text) return { ok: false, code: "empty_response", detail: "OpenAI returned no text." };

    return { ok: true, provider: PROVIDER, model: readiness.model, text };
  } catch (error) {
    return {
      ok: false,
      code: error?.name === "AbortError" ? "timed_out" : "failed",
      detail: error?.name === "AbortError"
        ? `OpenAI did not answer within ${timeoutMs}ms.`
        : "The OpenAI request failed."
    };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  PROVIDER,
  LABEL,
  ENDPOINT,
  HOST,
  DEFAULT_MODEL,
  MAX_OUTPUT_TOKENS,
  MODEL_PATTERN,
  getOpenAIReadiness,
  normalizeMessages,
  extractText,
  generate
};
