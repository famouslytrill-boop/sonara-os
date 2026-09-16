"use strict";

// One narrow selector for hosted model drafting.
//
// There is deliberately no automatic paid-provider fallback. A request that
// names OpenAI must not silently become an Anthropic request, and vice versa:
// that would change both cost and the processor receiving the prompt.

const openai = require("./sonara-openai-provider.cjs");
const anthropic = require("./sonara-anthropic-provider.cjs");

const LOCAL_PROVIDER = "local_rules";
const PROVIDERS = Object.freeze([LOCAL_PROVIDER, openai.PROVIDER, anthropic.PROVIDER]);

function configuredDefault() {
  // Keep the literal env read visible to scripts/verify-env.mjs. The shipped
  // value is local_rules; changing it is an operator decision, never fallback.
  return String(process.env.SONARA_AI_PROVIDER || LOCAL_PROVIDER).trim().toLowerCase();
}

function normalizeProvider(value) {
  return String(value || configuredDefault()).trim().toLowerCase();
}

function getProviderReadiness(options = {}) {
  return Object.freeze({
    local_rules: Object.freeze({
      ok: true,
      enabled: true,
      status: "ready",
      provider: LOCAL_PROVIDER,
      label: "SONARA deterministic rules",
      model: null,
      detail: "Runs without a hosted model or provider credential."
    }),
    openai: Object.freeze(openai.getOpenAIReadiness(options)),
    anthropic: Object.freeze(anthropic.getAnthropicReadiness(options))
  });
}

async function generate({ provider, messages, maxTokens } = {}, options = {}) {
  const selected = normalizeProvider(provider);
  if (!PROVIDERS.includes(selected)) {
    return { ok: false, code: "unknown_provider", detail: `Provider ${selected || "(empty)"} is not allowed.` };
  }

  // local_rules is a safe default, but this router is a *model* drafting path.
  // It refuses rather than pretending deterministic code generated model text.
  if (selected === LOCAL_PROVIDER) {
    return {
      ok: false,
      code: "local_rules_only",
      detail: "SONARA deterministic rules are active. Choose a configured hosted provider only when you intentionally want model-generated drafting."
    };
  }

  if (selected === openai.PROVIDER) return openai.generate(messages, { ...options, maxTokens });
  return anthropic.generate(messages, { ...options, maxTokens });
}

module.exports = {
  LOCAL_PROVIDER,
  PROVIDERS,
  configuredDefault,
  normalizeProvider,
  getProviderReadiness,
  generate
};
