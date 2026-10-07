"use strict";

// A generation job that failed or was stopped could only be abandoned: the job
// page offered nothing, and starting again meant retyping the request. And
// stopping a job checked its status a moment before writing, so a job that
// completed -- and was charged -- in between could be cancelled, which releases
// the credit for work that was delivered.
//
// These tests drive both through the routes with the database and the credit
// allowance stubbed, and check what is written.

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const registerRoutes = require("../routes/creator-generation-routes.cjs");
const { createRateLimiter } = require("../lib/sonara-rate-limit.cjs");

const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const JOB_ID = "33333333-3333-4333-8333-333333333333";
const CONSENT_ID = "55555555-5555-4555-8555-555555555555";

function jsonResponse(status, value) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

function buildApp(allowanceCalls) {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  registerRoutes(app, {
    createRateLimiter: (options) => createRateLimiter({ ...options, getSupabaseServerConfig: () => ({ ok: false }) }),
    layout: ({ heading, body, sections = [] }) => `<html><h1>${heading}</h1><p>${body}</p>${sections.join("")}</html>`,
    brandCard: (title, body) => `<article><h2>${title}</h2><p>${body}</p></article>`,
    linkAction: (href, label) => `<a href="${href}">${label}</a>`,
    escapeHtml: (value) => String(value),
    requireWorkspaceAccess: () => (req, res, next) => { req.sonaraUser = { id: USER_ID, email: "creator@example.com" }; next(); },
    generationAllowance: async (call) => {
      allowanceCalls.push(call.action);
      return call.action === "settle" ? { ok: true, legacy: true } : { ok: true, allowanceMinor: 500, remainingMinor: 500, reservedMinor: 0 };
    },
    getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId: ORGANIZATION_ID }),
    getSupabaseServerConfig: () => ({ ok: true, url: "https://project.supabase.co", serviceRoleKey: "server-only" })
  });
  return app;
}

function jobRecord(overrides = {}) {
  return {
    id: JOB_ID,
    organization_id: ORGANIZATION_ID,
    user_id: USER_ID,
    capability: "sound_effects",
    provider_key: "elevenlabs",
    title: "Warehouse door",
    prompt: "A heavy metal door closing in a quiet warehouse",
    negative_prompt: "music",
    parameters: { duration_seconds: 4 },
    input_assets: [],
    status: "failed",
    error_code: "provider_dispatch_failed",
    rights_attested: true,
    consent_attested: false,
    voice_consent_id: null,
    policy_status: "approved",
    policy_reasons: [],
    ...overrides
  };
}

// The database, as the routes see it: the one job, inserts captured, events
// captured, and a PATCH that answers as the conditional write would.
function stubDatabase({ job, patchMatches = true, consent = null }) {
  const writes = { inserts: [], events: [], patches: [], usage: [] };
  global.fetch = async (url, options = {}) => {
    const target = String(url);
    const method = options.method || "GET";
    const table = (target.split("/rest/v1/")[1] || "").split("?")[0];
    // Releasing a stopped job's credit goes through this RPC directly, not the
    // injected allowance, so this is where it is observed.
    if (table === "rpc/generation_usage") {
      const call = JSON.parse(options.body);
      writes.usage.push(call.p_action);
      return jsonResponse(200, { ok: true });
    }
    if (method === "POST" && table === "creator_generation_events") {
      writes.events.push(JSON.parse(options.body));
      return jsonResponse(201, [JSON.parse(options.body)]);
    }
    if (method === "POST" && table === "creator_generation_jobs") {
      const row = JSON.parse(options.body);
      writes.inserts.push(row);
      return jsonResponse(201, [row]);
    }
    if (method === "PATCH" && table === "creator_generation_jobs") {
      writes.patches.push({ url: target, body: JSON.parse(options.body) });
      return jsonResponse(200, patchMatches ? [{ ...job, ...JSON.parse(options.body) }] : []);
    }
    if (table === "creator_voice_consents") return jsonResponse(200, consent ? [consent] : []);
    if (table === "creator_generation_jobs") return jsonResponse(200, [job]);
    return jsonResponse(200, []);
  };
  return writes;
}

describe("a failed generation can be tried again", () => {
  let savedFetch;
  let savedEnv;
  beforeEach(() => {
    savedFetch = global.fetch;
    savedEnv = { key: process.env.ELEVENLABS_API_KEY, enabled: process.env.ELEVENLABS_ENABLED };
    // No provider configured: a retry lands setup_required, so no reservation
    // or dispatch is involved unless a test sets one up.
    delete process.env.ELEVENLABS_API_KEY;
    delete process.env.ELEVENLABS_ENABLED;
  });
  afterEach(() => {
    global.fetch = savedFetch;
    if (savedEnv.key === undefined) delete process.env.ELEVENLABS_API_KEY; else process.env.ELEVENLABS_API_KEY = savedEnv.key;
    if (savedEnv.enabled === undefined) delete process.env.ELEVENLABS_ENABLED; else process.env.ELEVENLABS_ENABLED = savedEnv.enabled;
  });

  it("offers to try a failed job again, and not a completed one", async () => {
    stubDatabase({ job: jobRecord() });
    const failed = await request(buildApp([])).get(`/creator-studio/generation/jobs/${JOB_ID}`);
    assert.ok(failed.text.includes(`action="/api/creator/generation/jobs/${JOB_ID}/retry"`), "a failed job has no way to try again");
    stubDatabase({ job: jobRecord({ status: "completed" }) });
    const done = await request(buildApp([])).get(`/creator-studio/generation/jobs/${JOB_ID}`);
    assert.ok(!done.text.includes("/retry"), "a completed, charged job is offered as retryable");
  });

  it("tries it again as a new job with the same request, and links the two", async () => {
    const writes = stubDatabase({ job: jobRecord() });
    const response = await request(buildApp([])).post(`/api/creator/generation/jobs/${JOB_ID}/retry`).set("accept", "text/html").send("go=1");
    assert.equal(writes.inserts.length, 1, `the retry wrote ${writes.inserts.length} jobs`);
    const fresh = writes.inserts[0];
    assert.notEqual(fresh.id, JOB_ID, "the original job was reused rather than a new one made");
    for (const field of ["capability", "provider_key", "prompt", "negative_prompt", "title"]) assert.equal(fresh[field], jobRecord()[field], `${field} was not carried over`);
    assert.deepEqual(fresh.parameters, { duration_seconds: 4 });
    assert.equal(fresh.rights_attested, true);
    assert.equal(response.status, 303);
    assert.equal(response.headers.location, `/creator-studio/generation/jobs/${fresh.id}`);
    const created = writes.events.find((entry) => entry.event_type === "generation.job_created");
    assert.equal(created.details.retry_of, JOB_ID, "the new job does not say what it retries");
    const retried = writes.events.find((entry) => entry.event_type === "generation.job_retried");
    assert.equal(retried.job_id, JOB_ID);
    assert.equal(retried.details.retried_as, fresh.id, "the original does not say what replaced it");
    assert.equal(writes.patches.length, 0, "the original job was changed");
  });

  it("refuses to retry a completed job, and writes nothing", async () => {
    const writes = stubDatabase({ job: jobRecord({ status: "completed" }) });
    const response = await request(buildApp([])).post(`/api/creator/generation/jobs/${JOB_ID}/retry`).send({});
    assert.equal(response.status, 409);
    assert.equal(response.body.code, "job_not_retryable");
    assert.equal(writes.inserts.length, 0);
  });

  it("checks a voice permission again, so a revoked one refuses the retry", async () => {
    const writes = stubDatabase({
      job: jobRecord({ capability: "voice_clone", consent_attested: true, voice_consent_id: CONSENT_ID }),
      consent: { id: CONSENT_ID, consent_attested: true, consent_scope: "voice_clone", revoked_at: "2026-10-01T00:00:00Z" }
    });
    const response = await request(buildApp([])).post(`/api/creator/generation/jobs/${JOB_ID}/retry`).send({});
    assert.equal(response.status, 400);
    assert.equal(response.body.code, "active_voice_consent_required");
    assert.equal(writes.inserts.length, 0, "a retry went round a revoked voice permission");
  });

  it("stops a job only if it is still unfinished when the write lands", async () => {
    const allowance = [];
    const writes = stubDatabase({ job: jobRecord({ status: "running" }), patchMatches: false });
    const response = await request(buildApp(allowance)).post(`/api/creator/generation/jobs/${JOB_ID}/cancel`).send({});
    assert.equal(writes.patches.length, 1);
    assert.match(decodeURIComponent(writes.patches[0].url), /status=not\.in\.\(completed,failed,cancelled\)/, "the cancel write is not conditional on the job being unfinished");
    assert.equal(response.status, 409, "a job that finished in between was reported as stopped");
    assert.equal(response.body.code, "job_not_cancellable");
    assert.ok(!allowance.includes("release") && !writes.usage.includes("release"), "credit was released for a job that had finished");
    assert.ok(!writes.events.some((entry) => entry.event_type === "generation.job_cancelled"), "the history says it was stopped");
  });

  it("still stops an unfinished job and releases its credit", async () => {
    const allowance = [];
    const writes = stubDatabase({ job: jobRecord({ status: "running" }), patchMatches: true });
    const response = await request(buildApp(allowance)).post(`/api/creator/generation/jobs/${JOB_ID}/cancel`).send({});
    assert.equal(response.status, 200);
    assert.equal(writes.patches[0].body.status, "cancelled");
    assert.ok(writes.usage.includes("release"), "a stopped job kept its reserved credit");
  });
});
