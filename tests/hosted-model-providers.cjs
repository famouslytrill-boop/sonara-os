"use strict";

const assert = require("node:assert/strict");
const openai = require("../lib/sonara-openai-provider.cjs");
const anthropic = require("../lib/sonara-anthropic-provider.cjs");
const router = require("../lib/sonara-model-provider-router.cjs");

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  };
}

describe("hosted model providers", () => {
  it("keeps OpenAI off until a server-side key exists and never renders the key", () => {
    const off = openai.getOpenAIReadiness({ env: {} });
    assert.equal(off.status, "disabled");
    assert.equal(off.enabled, false);

    const ready = openai.getOpenAIReadiness({
      env: { OPENAI_API_KEY: "sk-test-secret", SONARA_OPENAI_MODEL: "gpt-5.6-luna" }
    });
    assert.equal(ready.status, "configured");
    assert.equal(ready.apiKey, "sk-test-secret");
    assert.equal(JSON.stringify(ready).includes("sk-test-secret"), false);
    assert.equal(ready.host, "api.openai.com");
  });

  it("calls only the official OpenAI Responses endpoint with storage disabled", async () => {
    const readiness = openai.getOpenAIReadiness({
      env: { OPENAI_API_KEY: "sk-test-secret", SONARA_OPENAI_MODEL: "gpt-5.6-luna", SONARA_PROVIDER_TIMEOUT_MS: "1000" }
    });
    let seen;
    const result = await openai.generate([{ role: "user", content: "Draft a short proposal." }], {
      readiness,
      fetchImpl: async (url, options) => {
        seen = { url, options };
        return jsonResponse({ output: [{ content: [{ type: "output_text", text: "Proposal draft" }] }] });
      },
      maxTokens: 200
    });

    assert.equal(result.ok, true);
    assert.equal(result.text, "Proposal draft");
    assert.equal(seen.url, "https://api.openai.com/v1/responses");
    assert.equal(seen.options.headers.Authorization, "Bearer sk-test-secret");
    const body = JSON.parse(seen.options.body);
    assert.equal(body.model, "gpt-5.6-luna");
    assert.equal(body.store, false);
    assert.equal(body.max_output_tokens, 200);
    assert.deepEqual(body.input, [{ role: "user", content: "Draft a short proposal." }]);
  });

  it("does not expose OpenAI keys or configured URLs in request failures", async () => {
    const readiness = openai.getOpenAIReadiness({ env: { OPENAI_API_KEY: "sk-never-render" } });
    const result = await openai.generate([{ role: "user", content: "hello" }], {
      readiness,
      fetchImpl: async () => { throw new Error("failed https://api.openai.com/v1/responses sk-never-render"); }
    });
    assert.equal(result.ok, false);
    assert.equal(JSON.stringify(result).includes("sk-never-render"), false);
    assert.equal(JSON.stringify(result).includes("https://api.openai.com"), false);
  });

  it("keeps Claude off until a server-side key exists and never renders the key", () => {
    const off = anthropic.getAnthropicReadiness({ env: {} });
    assert.equal(off.status, "disabled");
    assert.equal(off.enabled, false);

    const ready = anthropic.getAnthropicReadiness({
      env: { ANTHROPIC_API_KEY: "sk-ant-test-secret", SONARA_ANTHROPIC_MODEL: "claude-sonnet-5" }
    });
    assert.equal(ready.status, "configured");
    assert.equal(ready.apiKey, "sk-ant-test-secret");
    assert.equal(JSON.stringify(ready).includes("sk-ant-test-secret"), false);
    assert.equal(ready.host, "api.anthropic.com");
  });

  it("uses the Anthropic Messages contract and keeps system instructions out of conversation messages", async () => {
    const readiness = anthropic.getAnthropicReadiness({
      env: { ANTHROPIC_API_KEY: "sk-ant-test-secret", SONARA_ANTHROPIC_MODEL: "claude-sonnet-5", SONARA_PROVIDER_TIMEOUT_MS: "1000" }
    });
    let seen;
    const result = await anthropic.generate([
      { role: "system", content: "Draft only." },
      { role: "developer", content: "Do not claim it was sent." },
      { role: "user", content: "Write an offer." }
    ], {
      readiness,
      fetchImpl: async (url, options) => {
        seen = { url, options };
        return jsonResponse({ content: [{ type: "text", text: "Offer draft" }] });
      },
      maxTokens: 250
    });

    assert.equal(result.ok, true);
    assert.equal(result.text, "Offer draft");
    assert.equal(seen.url, "https://api.anthropic.com/v1/messages");
    assert.equal(seen.options.headers["x-api-key"], "sk-ant-test-secret");
    assert.equal(seen.options.headers["anthropic-version"], "2023-06-01");
    const body = JSON.parse(seen.options.body);
    assert.equal(body.model, "claude-sonnet-5");
    assert.equal(body.max_tokens, 250);
    assert.match(body.system, /Draft only/);
    assert.match(body.system, /Do not claim it was sent/);
    assert.deepEqual(body.messages, [{ role: "user", content: "Write an offer." }]);
  });

  it("never silently changes providers", async () => {
    const local = await router.generate({ provider: "local_rules", messages: [{ role: "user", content: "x" }] });
    assert.equal(local.code, "local_rules_only");

    const unknown = await router.generate({ provider: "somewhere_else", messages: [{ role: "user", content: "x" }] });
    assert.equal(unknown.code, "unknown_provider");
  });
});

describe("founder business drafting surface", () => {
  // These three used to drive /admin/ai-integrations/business-draft -- a page
  // where the platform owner picked ChatGPT or Claude and got a labelled draft
  // back. It was an /admin page and went with the operator console on 1 October
  // 2026, so the HTML surface is gone and is NOT rebuilt here; that is a product
  // decision for the owner, recorded in docs/SPRINT_LOG.md.
  //
  // The contract underneath it survives in lib/sonara-model-provider-router.cjs
  // and both provider adapters, and so does the coverage. Driving the router
  // directly is in one way stronger: the route tests asserted that a page said
  // "Nothing has been sent", while these assert that the router refuses before a
  // network call and never claims deterministic output came from a model.

  it("refuses an unconfigured provider before any network call", async () => {
    let called = false;
    const result = await router.generate(
      { provider: "openai", messages: [{ role: "user", content: "draft" }] },
      {
        env: {},
        fetchImpl: async () => { called = true; return jsonResponse({}, 200); }
      }
    );

    assert.equal(result.ok, false);
    assert.equal(called, false, "an unconfigured provider reached the network");
    assert.match(String(result.detail || result.error || ""), /OPENAI_API_KEY/);
  });

  it("refuses to attribute deterministic rules to a model", async () => {
    // The router's own reason, asserted rather than paraphrased: selecting the
    // local rules engine must not come back looking like generated text.
    const result = await router.generate(
      { provider: "local_rules", messages: [{ role: "user", content: "draft" }] },
      { env: {}, fetchImpl: async () => jsonResponse({}, 200) }
    );
    assert.equal(result.ok, false);
    assert.match(String(result.detail || result.error || ""), /deterministic/i);
  });

  it("offers both hosted providers, and neither until its own key exists", () => {
    const none = router.getProviderReadiness({ env: {} });
    assert.equal(none.openai.enabled, false);
    assert.equal(none.anthropic.enabled, false);

    const both = router.getProviderReadiness({
      env: { OPENAI_API_KEY: "sk-test-secret", ANTHROPIC_API_KEY: "sk-ant-test-secret" }
    });
    assert.equal(both.openai.enabled, true);
    assert.equal(both.anthropic.enabled, true);
    // Neither readiness object may carry a key value, which is the AGENTS.md
    // rule that service-role secrets stay server-only, asserted on the shape
    // that gets rendered.
    assert.equal(JSON.stringify(both).includes("sk-test-secret"), false);
    assert.equal(JSON.stringify(both).includes("sk-ant-test-secret"), false);
  });
});

require("./runtime-capability-planner.cjs");
require("./generation-execution-contract.cjs");
