"use strict";

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const openai = require("../lib/sonara-openai-provider.cjs");
const anthropic = require("../lib/sonara-anthropic-provider.cjs");
const router = require("../lib/sonara-model-provider-router.cjs");
const registerRoutes = require("../routes/sonara-ai-integrations-routes.cjs");

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
  function buildApp(modelProviders) {
    const app = express();
    app.use(express.urlencoded({ extended: false }));
    app.use(express.json());
    registerRoutes(app, {
      modelProviders,
      requireAdmin: (req, res, next) => next(),
      layout: ({ title, heading, body, sections = [], actions = [] }) => `<html><head><title>${title}</title></head><body><h1>${heading}</h1><p>${body}</p>${actions.join("")}${sections.join("")}</body></html>`,
      brandCard: (title, body) => `<article><h2>${title}</h2><p>${body}</p></article>`,
      linkAction: (href, label) => `<a href="${href}">${label}</a>`,
      recordAdminAuditEvent: async () => undefined
    });
    return app;
  }

  function configuredReadiness() {
    return {
      local_rules: { status: "ready", enabled: true, detail: "ready" },
      openai: { status: "configured", enabled: true, model: "gpt-5.6-luna", detail: "configured" },
      anthropic: { status: "configured", enabled: true, model: "claude-sonnet-5", detail: "configured" }
    };
  }

  it("renders explicit Claude and ChatGPT choices without exposing customer records", async () => {
    const app = buildApp({
      getProviderReadiness: configuredReadiness,
      generate: async () => ({ ok: true, provider: "openai", model: "gpt-5.6-luna", text: "draft" })
    });
    const response = await request(app).get("/admin/ai-integrations/business-draft");
    assert.equal(response.status, 200);
    assert.match(response.text, /OpenAI \/ ChatGPT/);
    assert.match(response.text, /Anthropic Claude/);
    assert.match(response.text, /does not pull customer records/i);
  });

  it("runs a selected hosted provider as draft_content and labels the result as unsent", async () => {
    const calls = [];
    const app = buildApp({
      getProviderReadiness: configuredReadiness,
      generate: async (request) => {
        calls.push(request);
        return { ok: true, provider: request.provider, model: "gpt-5.6-luna", text: "Reviewable draft" };
      }
    });

    const response = await request(app)
      .post("/admin/ai-integrations/business-draft")
      .type("form")
      .send({ provider: "openai", prompt: "Draft a two-sentence service proposal." });

    assert.equal(response.status, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].provider, "openai");
    assert.match(calls[0].messages[0].content, /Produce a draft only/);
    assert.equal(calls[0].messages[1].content, "Draft a two-sentence service proposal.");
    assert.match(response.text, /Nothing has been sent, published, approved, or saved/i);
  });

  it("refuses unconfigured providers before any network call", async () => {
    let called = false;
    const app = buildApp({
      getProviderReadiness: () => ({
        local_rules: { status: "ready", enabled: true, detail: "ready" },
        openai: { status: "disabled", enabled: false, model: "gpt-5.6-luna", detail: "OPENAI_API_KEY is not configured." },
        anthropic: { status: "disabled", enabled: false, model: "claude-sonnet-5", detail: "ANTHROPIC_API_KEY is not configured." }
      }),
      generate: async () => { called = true; return { ok: true, text: "should not happen" }; }
    });

    const response = await request(app)
      .post("/admin/ai-integrations/business-draft")
      .type("form")
      .send({ provider: "openai", prompt: "draft" });

    assert.equal(response.status, 503);
    assert.equal(called, false);
    assert.match(response.text, /OPENAI_API_KEY is not configured/);
  });
});

require("./runtime-capability-planner.cjs");
