"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const request = require("supertest");
const registerRoutes = require("../routes/creator-generation-routes.cjs");

const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const JOB_ID = "33333333-3333-4333-8333-333333333333";
const ASSET_ID = "44444444-4444-4444-8444-444444444444";

function buildApp({ paid = true } = {}) {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  registerRoutes(app, {
    layout: ({ title, heading, body, sections = [] }) => `<html><title>${title}</title><h1>${heading}</h1><p>${body}</p>${sections.join("")}</html>`,
    brandCard: (title, body) => `<article><h2>${title}</h2><p>${body}</p></article>`,
    linkAction: (href, label) => `<a href="${href}">${label}</a>`,
    escapeHtml: (value) => String(value).replace(/[&<>"']/g, ""),
    requireWorkspaceAccess: () => (req, res, next) => {
      if (!paid) return res.status(402).json({ ok: false, code: "upgrade_required" });
      req.sonaraUser = { id: USER_ID, email: "creator@example.com" };
      return next();
    },
    getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId: ORGANIZATION_ID }),
    getSupabaseServerConfig: () => ({ ok: true, url: "https://project.supabase.co", serviceRoleKey: "server-only" })
  });
  return app;
}

function jsonResponse(status, value, headers = {}) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json", ...headers } });
}

function binaryResponse(status, bytes, mime = "audio/mpeg") {
  return new Response(Buffer.from(bytes), { status, headers: { "content-type": mime, "content-length": String(bytes.length) } });
}

function jobRecord(overrides = {}) {
  return {
    id: JOB_ID,
    organization_id: ORGANIZATION_ID,
    user_id: USER_ID,
    capability: "sound_effects",
    provider_key: "elevenlabs",
    prompt: "A cinematic metal door closing in a quiet warehouse",
    parameters: {},
    input_assets: [],
    status: "queued",
    progress_percent: 0,
    rights_attested: true,
    consent_attested: false,
    policy_status: "approved",
    policy_reasons: [],
    ...overrides
  };
}

describe("Creator Studio generation platform", () => {
  let originalFetch;
  let originalEnv;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
  });

  it("publishes a governed provider catalog without credential values", async () => {
    process.env.ELEVENLABS_ENABLED = "true";
    process.env.ELEVENLABS_API_KEY = "top-secret-key";
    const result = await request(buildApp()).get("/api/creator/generation/providers");
    assert.equal(result.status, 200);
    assert.equal(result.body.ok, true);
    assert.ok(result.body.providers.some((item) => item.key === "elevenlabs"));
    assert.ok(result.body.providers.some((item) => item.key === "google_veo"));
    assert.ok(result.body.providers.some((item) => item.key === "higgsfield"));
    assert.ok(result.body.providers.some((item) => item.key === "openvoice"));
    assert.doesNotMatch(JSON.stringify(result.body), /top-secret-key/);
  });

  it("requires paid Creator Studio access", async () => {
    const result = await request(buildApp({ paid: false })).get("/api/creator/generation/jobs");
    assert.equal(result.status, 402);
    assert.equal(result.body.code, "upgrade_required");
  });

  it("rejects generation without a rights attestation", async () => {
    const result = await request(buildApp())
      .post("/api/creator/generation/jobs")
      .send({ capability: "text_to_music", provider_key: "elevenlabs", prompt: "Original minor-key instrumental" });
    assert.equal(result.status, 400);
    assert.equal(result.body.code, "rights_attestation_required");
  });

  it("holds direct artist or identity imitation language for review instead of dispatching", async () => {
    const calls = [];
    global.fetch = async (url, options = {}) => {
      calls.push({ url: String(url), method: options.method || "GET", body: options.body ? JSON.parse(options.body) : undefined });
      if (String(url).includes(`/rest/v1/creator_generation_jobs`) && options.method === "POST") {
        return jsonResponse(201, [jobRecord({ capability: "text_to_music", status: "review_required", policy_status: "review_required", policy_reasons: ["direct_identity_or_work_imitation_language"] })]);
      }
      if (String(url).includes(`/rest/v1/creator_generation_events`)) return jsonResponse(201, []);
      return jsonResponse(200, []);
    };

    const result = await request(buildApp())
      .post("/api/creator/generation/jobs")
      .send({ capability: "text_to_music", provider_key: "elevenlabs", prompt: "Make this sound exactly like a famous artist", rights_attested: true });

    assert.equal(result.status, 201);
    assert.equal(result.body.job.status, "review_required");
    assert.equal(calls.some((call) => call.url.includes("api.elevenlabs.io")), false);
  });

  it("requires an active consent record for speech-to-speech", async () => {
    const result = await request(buildApp())
      .post("/api/creator/generation/jobs")
      .send({ capability: "speech_to_speech", provider_key: "elevenlabs", prompt: "Convert this authorized recording", rights_attested: true });
    assert.equal(result.status, 400);
    assert.equal(result.body.code, "active_voice_consent_required");
  });

  it("records Higgsfield jobs as external MCP work rather than pretending to call an undocumented REST endpoint", async () => {
    const calls = [];
    global.fetch = async (url, options = {}) => {
      calls.push({ url: String(url), method: options.method || "GET" });
      if (String(url).includes(`/rest/v1/creator_generation_jobs`) && options.method === "POST") {
        return jsonResponse(201, [jobRecord({ capability: "text_to_video", provider_key: "higgsfield", status: "manual_required", provider_response: { connector: "external_mcp", endpoint: "https://mcp.higgsfield.ai" } })]);
      }
      if (String(url).includes(`/rest/v1/creator_generation_events`)) return jsonResponse(201, []);
      return jsonResponse(200, []);
    };

    const result = await request(buildApp())
      .post("/api/creator/generation/jobs")
      .send({ capability: "text_to_video", provider_key: "higgsfield", prompt: "Original product launch scene", rights_attested: true });

    assert.equal(result.status, 201);
    assert.equal(result.body.job.status, "manual_required");
    assert.equal(calls.some((call) => call.url.startsWith("https://mcp.higgsfield.ai")), false);
  });

  it("dispatches ElevenLabs sound generation and stores the binary output in private Supabase storage", async () => {
    process.env.ELEVENLABS_ENABLED = "true";
    process.env.ELEVENLABS_API_KEY = "test-elevenlabs-key";
    const calls = [];
    let job = jobRecord();

    global.fetch = async (url, options = {}) => {
      const stringUrl = String(url);
      const method = options.method || "GET";
      calls.push({ url: stringUrl, method, headers: options.headers, body: options.body });

      if (stringUrl.includes(`/rest/v1/creator_generation_jobs`) && method === "POST") return jsonResponse(201, [job]);
      if (stringUrl.includes(`/rest/v1/creator_generation_jobs`) && method === "PATCH") {
        const patch = JSON.parse(options.body);
        job = { ...job, ...patch };
        return jsonResponse(200, [job]);
      }
      if (stringUrl.includes(`/rest/v1/creator_generation_events`)) return jsonResponse(201, []);
      if (stringUrl === "https://api.elevenlabs.io/v1/sound-generation") return binaryResponse(200, Buffer.from("audio-output"), "audio/mpeg");
      if (stringUrl.includes(`/storage/v1/object/creator-assets/`) && method === "POST") return jsonResponse(200, { Key: "private-output" });
      if (stringUrl.includes(`/rest/v1/creator_generation_assets`) && method === "POST") {
        const body = JSON.parse(options.body);
        return jsonResponse(201, [{ id: ASSET_ID, ...body }]);
      }
      return jsonResponse(200, []);
    };

    const result = await request(buildApp())
      .post("/api/creator/generation/jobs")
      .send({ capability: "sound_effects", provider_key: "elevenlabs", prompt: job.prompt, rights_attested: true, parameters: { duration_seconds: 4 } });

    assert.equal(result.status, 201);
    assert.equal(result.body.job.status, "completed");
    assert.ok(calls.some((call) => call.url === "https://api.elevenlabs.io/v1/sound-generation"));
    const storageCall = calls.find((call) => call.url.includes("/storage/v1/object/creator-assets/"));
    assert.ok(storageCall);
    assert.equal(storageCall.headers.Authorization, "Bearer server-only");
    assert.doesNotMatch(storageCall.url, /test-elevenlabs-key/);
  });

  it("submits Google Veo through the documented long-running operation contract", async () => {
    process.env.GOOGLE_VEO_ENABLED = "true";
    process.env.GEMINI_API_KEY = "gemini-test-key";
    let job = jobRecord({ capability: "text_to_video", provider_key: "google_veo" });
    const calls = [];

    global.fetch = async (url, options = {}) => {
      const stringUrl = String(url);
      const method = options.method || "GET";
      calls.push({ url: stringUrl, method, headers: options.headers, body: options.body });
      if (stringUrl.includes(`/rest/v1/creator_generation_jobs`) && method === "POST") return jsonResponse(201, [job]);
      if (stringUrl.includes(`/rest/v1/creator_generation_jobs`) && method === "PATCH") {
        job = { ...job, ...JSON.parse(options.body) };
        return jsonResponse(200, [job]);
      }
      if (stringUrl.includes(`/rest/v1/creator_generation_events`)) return jsonResponse(201, []);
      if (stringUrl.includes(":predictLongRunning")) return jsonResponse(200, { name: "operations/veo-test-123" });
      return jsonResponse(200, []);
    };

    const result = await request(buildApp())
      .post("/api/creator/generation/jobs")
      .send({ capability: "text_to_video", provider_key: "google_veo", prompt: "Original cinematic sunrise over Columbus", rights_attested: true, parameters: { aspect_ratio: "16:9" } });

    assert.equal(result.status, 201);
    assert.equal(result.body.job.status, "running");
    assert.equal(result.body.job.provider_job_id, "operations/veo-test-123");
    const providerCall = calls.find((call) => call.url.includes(":predictLongRunning"));
    assert.ok(providerCall);
    assert.equal(providerCall.headers["x-goog-api-key"], "gemini-test-key");
    assert.match(providerCall.url, /veo-3\.1-generate-preview/);
  });

  it("uses the canonical isolated open-media-worker job contract", async () => {
    process.env.CREATOR_MEDIA_WORKER_ENABLED = "true";
    process.env.CREATOR_MEDIA_WORKER_URL = "https://worker.example.com";
    process.env.CREATOR_MEDIA_WORKER_TOKEN = "worker-token";
    let job = jobRecord({ capability: "text_to_music", provider_key: "open_source_media_worker" });
    const calls = [];

    global.fetch = async (url, options = {}) => {
      const stringUrl = String(url);
      const method = options.method || "GET";
      calls.push({ url: stringUrl, method, body: options.body, headers: options.headers });
      if (stringUrl.includes(`/rest/v1/creator_generation_jobs`) && method === "POST") return jsonResponse(201, [job]);
      if (stringUrl.includes(`/rest/v1/creator_generation_jobs`) && method === "PATCH") {
        job = { ...job, ...JSON.parse(options.body) };
        return jsonResponse(200, [job]);
      }
      if (stringUrl.includes(`/rest/v1/creator_generation_events`)) return jsonResponse(201, []);
      if (stringUrl === "https://worker.example.com/v1/jobs") return jsonResponse(202, { id: "worker-job-1", status: "queued", progress_percent: 1 });
      return jsonResponse(200, []);
    };

    const result = await request(buildApp())
      .post("/api/creator/generation/jobs")
      .send({ capability: "text_to_music", provider_key: "open_source_media_worker", prompt: "Original instrumental", rights_attested: true });

    assert.equal(result.status, 201);
    assert.equal(result.body.job.status, "running");
    const workerCall = calls.find((call) => call.url === "https://worker.example.com/v1/jobs");
    assert.ok(workerCall);
    const payload = JSON.parse(workerCall.body);
    assert.equal(payload.organization_id, ORGANIZATION_ID);
    assert.equal(payload.capability, "text_to_music");
    assert.equal(workerCall.headers.Authorization, "Bearer worker-token");
  });

  it("ships a private-output, RLS-first schema with no provider credential columns", () => {
    const migration = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "20260723080000_creator_generation_control_plane.sql"), "utf8");
    assert.match(migration, /creator_generation_jobs/);
    assert.match(migration, /creator_generation_assets/);
    assert.match(migration, /creator_voice_consents/);
    assert.match(migration, /creator_reference_analyses/);
    assert.match(migration, /enable row level security/);
    assert.match(migration, /sonara_is_org_member/);
    assert.match(migration, /service role manages/);
    assert.doesNotMatch(migration, /api_key\s+text|secret_key\s+text|access_token\s+text/i);
  });
});
