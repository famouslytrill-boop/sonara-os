"use strict";

// Anthropic Messages API provider for explicit owner/admin drafting.
// The API key is sent only to Anthropic's official API host. There is no
// environment-controlled base URL for a production credential.

const { boundTimeout, DEFAULT_TIMEOUT_MS } = require("./sonara-service-adapter.cjs");

const PROVIDER = "anthropic";
const LABEL = "Anthropic Claude";
const ENDPOINT = "https://api.anthropic.com/v1/messages";
const HOST = "api.anthropic.com";
const API_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-5";
const MAX_OUTPUT_TOKENS = 4096;
const MODEL_PATTERN = /^[a-z0-9][a-z0-9._:-]{1,127}$/i;
const PLACEHOLDER = /^(your[-_]|changeme|placeholder|example|xxx+|todo)/i;

function runtimeEnv(overrides) {
  if (overrides) return overrides;
  // Literal process.env reads are intentional: scripts/verify-env.mjs must see
  // every production setting this provider consumes.
  return {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    SONARA_ANTHROPIC_MODEL: process.env.SONARA_ANTHROPIC_MODEL,
    SONARA_PROVIDER_TIMEOUT_MS: process.env.SONARA_PROVIDER_TIMEOUT_MS
  };
}

function readEnv(env, key) {
  return String(env?.[key] || "").trim();
}

function timeoutFor(env) {
  return boundTimeout(readEnv(env, "SONARA_PROVIDER_TIMEOUT_MS")) || DEFAULT_TIMEOUT_MS;
}

function getAnthropicReadiness(options = {}) {
  const env = runtimeEnv(options.env);
  const model = readEnv(env, "SONARA_ANTHROPIC_MODEL") || DEFAULT_MODEL;
  const apiKey = readEnv(env, "ANTHROPIC_API_KEY");

  if (!MODEL_PATTERN.test(model)) {
    return {
      ok: false, enabled: false, status: "setup_required", provider: PROVIDER,
      label: LABEL, host: HOST, model,
      detail: "SONARA_ANTHROPIC_MODEL is not a valid model identifier."
    };
  }

  if (!apiKey || PLACEHOLDER.test(apiKey)) {
    return {
      ok: true, enabled: false, status: "disabled", provider: PROVIDER,
      label: LABEL, host: HOST, model, timeoutMs: timeoutFor(env),
      detail: "ANTHROPIC_API_KEY is not configured. Claude drafting stays off."
    };
  }

  const readiness = {
    ok: true, enabled: true, status: "configured", provider: PROVIDER,
    label: LABEL, host: HOST, model, timeoutMs: timeoutFor(env),
    detail: `Anthropic Claude is configured for ${model}.`
  };
  Object.defineProperty(readiness, "apiKey", { value: apiKey, enumerable: false, writable: false });
  return readiness;
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return null;
  const system = [];
  const conversation = [];
  for (const message of messages) {
    const role = String(message?.role || "").trim();
    const content = String(message?.content || "").trim();
    if (!content || !["system", "developer", "user", "assistant"].includes(role)) return null;
    if (role === "system" || role === "developer") system.push(content);
    else conversation.push({ role, content });
  }
  if (conversation.length === 0 || conversation[0].role !== "user") return null;
  return { system: system.join("\n\n"), messages: conversation };
}

function extractText(payload) {
  return (Array.isArray(payload?.content) ? payload.content : [])
    .filter((part) => part?.type === "text" && typeof part?.text === "string" && part.text.trim())
    .map((part) => part.text.trim())
    .join("\n")
    .trim();
}

async function generate(messages, options = {}) {
  const readiness = options.readiness || getAnthropicReadiness(options);
  const normalized = normalizeMessages(messages);
  if (!normalized) {
    return { ok: false, code: "invalid_messages", detail: "Claude drafting needs system/developer instructions plus a user-first user/assistant conversation." };
  }
  if (!readiness?.enabled || readiness.status !== "configured" || !readiness.apiKey) {
    return { ok: false, code: "setup_required", detail: readiness?.detail || "Anthropic Claude is not configured." };
  }
  if (!MODEL_PATTERN.test(String(readiness.model || ""))) {
    return { ok: false, code: "setup_required", detail: "The configured Claude model is not valid." };
  }

  const maxTokens = Math.min(Math.max(Number(options.maxTokens) || 700, 1), MAX_OUTPUT_TOKENS);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const timeoutMs = readiness.timeoutMs || DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const body = { model: readiness.model, max_tokens: maxTokens, messages: normalized.messages };
    if (normalized.system) body.system = normalized.system;
    const response = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": readiness.apiKey,
        "anthropic-version": API_VERSION
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    if (!response?.ok) {
      return { ok: false, code: "provider_refused", detail: `Anthropic did not accept the request (${response?.status || "no response"}).` };
    }
    const payload = await response.json().catch(() => null);
    if (!payload) return { ok: false, code: "unreadable_response", detail: "Anthropic returned a response SONARA could not read." };
    const text = extractText(payload);
    if (!text) return { ok: false, code: "empty_response", detail: "Anthropic returned no text." };
    return { ok: true, provider: PROVIDER, model: readiness.model, text };
  } catch (error) {
    return {
      ok: false,
      code: error?.name === "AbortError" ? "timed_out" : "failed",
      detail: error?.name === "AbortError" ? `Anthropic did not answer within ${timeoutMs}ms.` : "The Anthropic request failed."
    };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  PROVIDER, LABEL, ENDPOINT, HOST, API_VERSION, DEFAULT_MODEL, MAX_OUTPUT_TOKENS,
  MODEL_PATTERN, getAnthropicReadiness, normalizeMessages, extractText, generate
};
