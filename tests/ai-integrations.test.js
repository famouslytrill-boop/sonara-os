"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const request = require("supertest");
const app = require("../server");
const { getManifest } = require("../lib/sonara-ecosystem-manifest.cjs");
const { INFRASTRUCTURE_SERVICES, PIPELINE_LAYERS, envReadiness } = require("../lib/sonara-infrastructure-manifest.cjs");
const {
  AI_INTEGRATIONS,
  getPublicAIIntegrationCatalog,
  getStaticAIIntegrationReadiness,
  getAIIntegrationReadiness,
  appendProbePath,
  parseServiceUrl
} = require("../lib/sonara-ai-integration-registry.cjs");

const EXPECTED_KEYS = [
  "openclaw",
  "n8n",
  "ollama",
  "langflow",
  "dify",
  "langchain",
  "open_webui",
  "deepseek_v3",
  "gemini_cli",
  "ragflow",
  "claude_code",
  "crewai"
];

describe("governed AI integration registry", () => {
  it("classifies all twelve requested tools into bounded runtime roles", () => {
    assert.deepEqual(AI_INTEGRATIONS.map((item) => item.key), EXPECTED_KEYS);
    const counts = AI_INTEGRATIONS.reduce((result, item) => {
      result[item.runtimeClass] = (result[item.runtimeClass] || 0) + 1;
      return result;
    }, {});
    assert.deepEqual(counts, {
      http_service: 8,
      framework_library: 1,
      model_family: 1,
      developer_cli: 2
    });
    assert.ok(AI_INTEGRATIONS.every((item) => item.humanReviewRequired));
  });

  it("keeps every service adapter disabled when no enable flags are set", () => {
    const readiness = getStaticAIIntegrationReadiness({ NODE_ENV: "test" });
    const services = readiness.filter((item) => item.runtimeClass === "http_service");
    assert.equal(services.length, 8);
    assert.ok(services.every((item) => item.enabled === false));
    assert.ok(services.every((item) => item.configurationStatus === "disabled"));
  });

  it("integrates all service adapters into infrastructure readiness without making them launch blockers", () => {
    const serviceKeys = AI_INTEGRATIONS.filter((item) => item.runtimeClass === "http_service").map((item) => item.key);
    const infrastructureKeys = INFRASTRUCTURE_SERVICES.map((item) => item.key);
    for (const key of serviceKeys) assert.ok(infrastructureKeys.includes(key), `${key} must be in infrastructure readiness`);
    const optional = envReadiness({ NODE_ENV: "test" }).filter((item) => serviceKeys.includes(item.key));
    assert.equal(optional.length, 8);
    assert.ok(optional.every((item) => item.launchStatus === "optional_disabled"));
    assert.ok(optional.every((item) => item.configurationStatus === "disabled"));
    assert.ok(PIPELINE_LAYERS.some((item) => item.key === "auth_sessions"));
    assert.ok(PIPELINE_LAYERS.some((item) => item.key === "route_contract"));
    assert.ok(PIPELINE_LAYERS.some((item) => item.key === "ai_control_plane"));
  });

  it("treats supported production environment aliases as alternatives", () => {
    const readiness = envReadiness({
      SUPABASE_URL: "https://sonara.supabase.co",
      SUPABASE_ANON_KEY: "anon-test-value",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-test-value",
      VERCEL: "1",
      VERCEL_ENV: "production",
      APP_URL: "https://sonaraindustries.com",
      STRIPE_SECRET_KEY: "stripe-test-value",
      STRIPE_WEBHOOK_SECRET: "stripe-webhook-test-value",
      RESEND_API_KEY: "resend-test-value",
      RESEND_FROM_EMAIL: "support@sonaraindustries.com",
      SUPPORT_TO_EMAIL: "owner@sonaraindustries.com",
      VERCEL_GIT_COMMIT_SHA: "0123456789abcdef"
    });

    const required = readiness.filter((item) => item.launchStatus === "required");
    assert.deepEqual(required.map((item) => item.key), ["supabase", "vercel", "stripe", "resend", "github"]);
    assert.ok(required.every((item) => item.configured));
    assert.ok(readiness.find((item) => item.key === "vercel").env.some((item) => item.name.includes("APP_URL") && item.configured));
    assert.ok(readiness.find((item) => item.key === "resend").env.some((item) => item.name.includes("SUPPORT_TO_EMAIL") && item.configured));
    assert.ok(readiness.find((item) => item.key === "github").env.some((item) => item.name.includes("VERCEL_GIT_COMMIT_SHA") && item.configured));
  });

  it("returns a safe public catalog without credential configuration fields", () => {
    const catalog = getPublicAIIntegrationCatalog();
    const serialized = JSON.stringify(catalog);
    assert.equal(catalog.length, 12);
    assert.doesNotMatch(serialized, /credentialEnv|credentialHeader|enabledEnv|baseUrlEnv|GATEWAY_TOKEN|API_KEY|WORKER_TOKEN/);
    assert.ok(catalog.every((item) => item.repoUrl.startsWith("https://github.com/")));
  });

  it("rejects insecure external production URLs and URL-embedded credentials", () => {
    assert.equal(parseServiceUrl("http://example.com", { NODE_ENV: "production" }).code, "insecure_transport");
    assert.equal(parseServiceUrl("https://user:secret@example.com", { NODE_ENV: "production" }).code, "credentials_in_url");
    assert.equal(parseServiceUrl("http://127.0.0.1:11434", { NODE_ENV: "production" }).ok, true);
  });

  it("preserves service base paths when building probe URLs", () => {
    const target = appendProbePath(new URL("https://dify.example/v1"), "/info");
    assert.equal(target.toString(), "https://dify.example/v1/info");
  });

  it("performs only the configured service probe and never returns its secret", async () => {
    const calls = [];
    const secret = "test-openclaw-token";
    const readiness = await getAIIntegrationReadiness({
      env: {
        NODE_ENV: "test",
        OPENCLAW_ENABLED: "true",
        OPENCLAW_BASE_URL: "http://127.0.0.1:18789",
        OPENCLAW_GATEWAY_TOKEN: secret
      },
      probe: true,
      fetchImpl: async (target, options) => {
        calls.push({ target: String(target), options });
        return { ok: true, status: 200 };
      }
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].target, "http://127.0.0.1:18789/v1/models");
    assert.equal(calls[0].options.method, "GET");
    assert.equal(calls[0].options.redirect, "error");
    assert.equal(calls[0].options.headers.Authorization, `Bearer ${secret}`);
    assert.equal(readiness.integrations.find((item) => item.key === "openclaw").runtimeStatus, "ready");
    assert.doesNotMatch(JSON.stringify(readiness), new RegExp(secret));
  });
});

describe("governed AI integration runtime surfaces", () => {
  it("publishes the non-secret catalog", async () => {
    const response = await request(app)
      .get("/api/ecosystem/ai-integrations")
      .set("Accept", "application/json");

    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.integrationCount, 12);
    assert.deepEqual(response.body.integrations.map((item) => item.key), EXPECTED_KEYS);
    assert.doesNotMatch(response.text, /credentialEnv|GATEWAY_TOKEN|API_KEY|WORKER_TOKEN/);
  });

  it("protects live readiness behind founder/admin authentication", async () => {
    const response = await request(app)
      .get("/api/admin/ai-integrations/readiness")
      .set("Accept", "application/json");

    assert.notEqual(response.status, 200);
    assert.ok([401, 503].includes(response.status));
    assert.ok(["admin_auth_required", "setup_required"].includes(response.body.code));
  });

  it("includes the catalog in the ecosystem manifest", () => {
    const manifest = getManifest();
    assert.equal(manifest.externalInspirationAndAdapters.governedAIIntegrations.length, 12);
    assert.ok(manifest.adminControlPlane.routes.includes("/admin/ai-integrations"));
  });

  it("seeds non-secret database metadata for every tool", () => {
    const migration = fs.readFileSync(path.join(
      __dirname,
      "../supabase/migrations/20260721170000_governed_ai_integration_catalog.sql"
    ), "utf8");

    for (const key of EXPECTED_KEYS) assert.match(migration, new RegExp(`\\('${key}'`));
    assert.doesNotMatch(migration, /Bearer [A-Za-z0-9_-]{8,}/);
    assert.match(migration, /execution_enabled\"\s*:\s*false/);
  });

  it("pins optional local services and binds them to loopback", () => {
    const compose = fs.readFileSync(path.join(__dirname, "../docker-compose.ai.yml"), "utf8");
    assert.match(compose, /ollama\/ollama:0\.32\.0/);
    assert.match(compose, /open-webui\/open-webui:v0\.10\.2/);
    assert.match(compose, /langflowai\/langflow:1\.10\.2/);
    assert.match(compose, /n8nio\/n8n:2\.31\.4/);
    assert.equal((compose.match(/127\.0\.0\.1:/g) || []).length, 4);
  });
});
