"use strict";

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const registerRoutes = require("../routes/growth-studio-control-routes.cjs");

const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const CAMPAIGN_ID = "33333333-3333-4333-8333-333333333333";
const LEAD_ID = "44444444-4444-4444-8444-444444444444";
const CONTENT_ID = "55555555-5555-4555-8555-555555555555";
const JOB_ID = "66666666-6666-4666-8666-666666666666";
const SNAPSHOT_ID = "77777777-7777-4777-8777-777777777777";

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
      req.sonaraUser = { id: USER_ID, email: "growth@example.com" };
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

function emptyResponse(status = 204) {
  return new Response(null, { status });
}

function providerJob(overrides = {}) {
  return {
    id: JOB_ID,
    organization_id: ORGANIZATION_ID,
    user_id: USER_ID,
    campaign_id: CAMPAIGN_ID,
    provider_key: "hubspot",
    capability: "campaign_create",
    operation: "campaign_create",
    idempotency_key: "job-key-1",
    request_payload: { name: "Launch campaign" },
    status: "queued",
    progress_percent: 0,
    approval_required: false,
    provider_response: {},
    ...overrides
  };
}

describe("Growth Studio operating system", () => {
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

  it("publishes provider readiness without credential values", async () => {
    process.env.HUBSPOT_ENABLED = "true";
    process.env.HUBSPOT_ACCESS_TOKEN = "hubspot-secret";
    process.env.KLAVIYO_ENABLED = "true";
    process.env.KLAVIYO_PRIVATE_API_KEY = "klaviyo-secret";
    const result = await request(buildApp()).get("/api/growth/providers");
    assert.equal(result.status, 200);
    assert.equal(result.body.ok, true);
    for (const key of ["hubspot", "klaviyo", "posthog", "google_analytics", "google_ads", "tiktok_content", "growthbook", "mautic", "dittofeed", "n8n"]) {
      assert.ok(result.body.providers.some((provider) => provider.key === key), key);
    }
    assert.doesNotMatch(JSON.stringify(result.body), /hubspot-secret|klaviyo-secret/);
  });

  it("requires paid Growth Studio access", async () => {
    const result = await request(buildApp({ paid: false })).get("/api/growth/campaigns");
    assert.equal(result.status, 402);
    assert.equal(result.body.code, "upgrade_required");
  });

  it("creates a tenant-scoped campaign and append-only control event", async () => {
    const calls = [];
    global.fetch = async (url, options = {}) => {
      const stringUrl = String(url);
      calls.push({ url: stringUrl, method: options.method || "GET", body: options.body ? JSON.parse(options.body) : null });
      if (stringUrl.includes("/rest/v1/growth_campaigns") && options.method === "POST") {
        const body = JSON.parse(options.body);
        return jsonResponse(201, [{ id: CAMPAIGN_ID, ...body }]);
      }
      if (stringUrl.includes("/rest/v1/growth_control_events") && options.method === "POST") return jsonResponse(201, []);
      return jsonResponse(200, []);
    };

    const result = await request(buildApp()).post("/api/growth/campaigns").send({ name: "Neighborhood launch", goal: "Generate qualified consultations", channel: "multi_channel" });
    assert.equal(result.status, 201);
    assert.equal(result.body.campaign.organization_id, ORGANIZATION_ID);
    assert.equal(result.body.campaign.user_id, USER_ID);
    const eventCall = calls.find((call) => call.url.includes("growth_control_events"));
    assert.equal(eventCall.body.event_type, "campaign.created");
  });

  it("requires a lawful tracking-basis attestation before recording touchpoints", async () => {
    const result = await request(buildApp()).post("/api/growth/touchpoints").send({ event_name: "landing_page_view" });
    assert.equal(result.status, 400);
    assert.equal(result.body.code, "tracking_basis_attestation_required");
  });

  it("requires audience consent basis for lifecycle content", async () => {
    const result = await request(buildApp()).post("/api/growth/content").send({ channel: "email", content_type: "email", title: "Follow-up" });
    assert.equal(result.status, 400);
    assert.equal(result.body.code, "audience_consent_basis_required");
  });

  it("requires explicit approval before any provider publishing job", async () => {
    global.fetch = async (url, options = {}) => {
      if (String(url).includes(`/rest/v1/growth_content_queue`) && (options.method || "GET") === "GET") {
        return jsonResponse(200, [{ id: CONTENT_ID, organization_id: ORGANIZATION_ID, user_id: USER_ID, campaign_id: CAMPAIGN_ID, channel: "tiktok", content_type: "social_post", approval_status: "draft", publish_status: "not_scheduled" }]);
      }
      return jsonResponse(200, []);
    };
    const result = await request(buildApp()).post(`/api/growth/content/${CONTENT_ID}/publish`).send({ provider_key: "tiktok_content", operation: "direct_post" });
    assert.equal(result.status, 400);
    assert.equal(result.body.code, "explicit_publish_approval_required");
  });

  it("rejects arbitrary automation code and unsafe expressions", async () => {
    const result = await request(buildApp()).post("/api/growth/automations").send({
      name: "Unsafe",
      trigger_key: "lead_created",
      action_key: "send_webhook",
      config: { transform: "require('child_process').exec('whoami')" }
    });
    assert.equal(result.status, 400);
    assert.equal(result.body.code, "arbitrary_automation_code_prohibited");
  });

  it("creates safe automation templates disabled by default", async () => {
    global.fetch = async (url, options = {}) => {
      if (String(url).includes("/rest/v1/automation_rules") && options.method === "POST") {
        const body = JSON.parse(options.body);
        return jsonResponse(201, [{ id: "88888888-8888-4888-8888-888888888888", ...body }]);
      }
      return jsonResponse(200, []);
    };
    const result = await request(buildApp()).post("/api/growth/automations").send({ trigger_key: "lead_qualified", action_key: "notify_owner", config: { channel: "in_app" } });
    assert.equal(result.status, 201);
    assert.equal(result.body.automation.status, "disabled");
  });

  it("dispatches a HubSpot campaign through the documented 2026-03 endpoint", async () => {
    process.env.HUBSPOT_ENABLED = "true";
    process.env.HUBSPOT_ACCESS_TOKEN = "hubspot-test-token";
    let job = providerJob();
    const calls = [];
    global.fetch = async (url, options = {}) => {
      const stringUrl = String(url);
      const method = options.method || "GET";
      calls.push({ url: stringUrl, method, headers: options.headers, body: options.body });
      if (stringUrl.includes("/rest/v1/growth_provider_jobs") && method === "POST") return jsonResponse(201, [job]);
      if (stringUrl.includes("/rest/v1/growth_provider_jobs") && method === "PATCH") {
        job = { ...job, ...JSON.parse(options.body) };
        return jsonResponse(200, [job]);
      }
      if (stringUrl.includes("/rest/v1/growth_control_events")) return jsonResponse(201, []);
      if (stringUrl === "https://api.hubapi.com/marketing/campaigns/2026-03") return jsonResponse(201, { id: "hubspot-campaign-1", properties: { hs_name: "Launch campaign" } });
      return jsonResponse(200, []);
    };

    const result = await request(buildApp()).post("/api/growth/provider-jobs").send({ provider_key: "hubspot", capability: "campaign_create", operation: "campaign_create", idempotency_key: "job-key-1", campaign_id: CAMPAIGN_ID, request_payload: { name: "Launch campaign" } });
    assert.equal(result.status, 201);
    assert.equal(result.body.job.status, "completed");
    const providerCall = calls.find((call) => call.url === "https://api.hubapi.com/marketing/campaigns/2026-03");
    assert.ok(providerCall);
    assert.equal(providerCall.headers.Authorization, "Bearer hubspot-test-token");
    assert.deepEqual(JSON.parse(providerCall.body), { properties: { hs_name: "Launch campaign" } });
  });

  it("submits a deduplicated Klaviyo event using the current revision header", async () => {
    process.env.KLAVIYO_ENABLED = "true";
    process.env.KLAVIYO_PRIVATE_API_KEY = "klaviyo-test-key";
    let job = providerJob({ provider_key: "klaviyo", capability: "event_create", operation: "event_create", request_payload: { email: "lead@example.com", metric_name: "Qualified Lead", properties: { campaign: "launch" } } });
    const calls = [];
    global.fetch = async (url, options = {}) => {
      const stringUrl = String(url);
      const method = options.method || "GET";
      calls.push({ url: stringUrl, method, headers: options.headers, body: options.body });
      if (stringUrl.includes("/rest/v1/growth_provider_jobs") && method === "POST") return jsonResponse(201, [job]);
      if (stringUrl.includes("/rest/v1/growth_provider_jobs") && method === "PATCH") {
        job = { ...job, ...JSON.parse(options.body) };
        return jsonResponse(200, [job]);
      }
      if (stringUrl.includes("/rest/v1/growth_control_events")) return jsonResponse(201, []);
      if (stringUrl === "https://a.klaviyo.com/api/events") return emptyResponse(202);
      return jsonResponse(200, []);
    };

    const result = await request(buildApp()).post("/api/growth/provider-jobs").send({ provider_key: "klaviyo", capability: "event_create", operation: "event_create", idempotency_key: "klaviyo-event-1", request_payload: job.request_payload });
    assert.equal(result.status, 201);
    assert.equal(result.body.job.status, "completed");
    const providerCall = calls.find((call) => call.url === "https://a.klaviyo.com/api/events");
    assert.ok(providerCall);
    assert.equal(providerCall.headers.revision, "2026-04-15");
    assert.match(providerCall.headers.Authorization, /^Klaviyo-API-Key /);
    const payload = JSON.parse(providerCall.body);
    assert.equal(payload.data.attributes.unique_id, "klaviyo-event-1");
  });

  it("captures a PostHog first-party event without exposing the project key in the SONARA response", async () => {
    process.env.POSTHOG_ENABLED = "true";
    process.env.POSTHOG_PROJECT_API_KEY = "phc_test_secret";
    let job = providerJob({ provider_key: "posthog", capability: "event_capture", operation: "event_capture", request_payload: { event: "consultation_booked", distinct_id: "lead-123", properties: { source: "website" } } });
    global.fetch = async (url, options = {}) => {
      const stringUrl = String(url);
      const method = options.method || "GET";
      if (stringUrl.includes("/rest/v1/growth_provider_jobs") && method === "POST") return jsonResponse(201, [job]);
      if (stringUrl.includes("/rest/v1/growth_provider_jobs") && method === "PATCH") {
        job = { ...job, ...JSON.parse(options.body) };
        return jsonResponse(200, [job]);
      }
      if (stringUrl.includes("/rest/v1/growth_control_events")) return jsonResponse(201, []);
      if (stringUrl === "https://us.i.posthog.com/capture/") return jsonResponse(200, { status: 1 });
      return jsonResponse(200, []);
    };
    const result = await request(buildApp()).post("/api/growth/provider-jobs").send({ provider_key: "posthog", capability: "event_capture", operation: "event_capture", idempotency_key: "posthog-event-1", request_payload: job.request_payload });
    assert.equal(result.status, 201);
    assert.equal(result.body.job.status, "completed");
    assert.doesNotMatch(JSON.stringify(result.body), /phc_test_secret/);
  });

  it("stores GA4 reports with sampling and freshness evidence", async () => {
    process.env.GA4_ENABLED = "true";
    process.env.GA4_PROPERTY_ID = "123456";
    process.env.GA4_ACCESS_TOKEN = "ga4-test-token";
    let job = providerJob({ provider_key: "google_analytics", capability: "run_report", operation: "run_report", request_payload: { report: { dateRanges: [{ startDate: "2026-07-01", endDate: "2026-07-22" }], metrics: [{ name: "activeUsers" }], dimensions: [{ name: "sessionSource" }] } } });
    const calls = [];
    global.fetch = async (url, options = {}) => {
      const stringUrl = String(url);
      const method = options.method || "GET";
      calls.push({ url: stringUrl, method, headers: options.headers, body: options.body });
      if (stringUrl.includes("/rest/v1/growth_provider_jobs") && method === "POST") return jsonResponse(201, [job]);
      if (stringUrl.includes("/rest/v1/growth_provider_jobs") && method === "PATCH") {
        job = { ...job, ...JSON.parse(options.body) };
        return jsonResponse(200, [job]);
      }
      if (stringUrl.includes("/rest/v1/growth_control_events")) return jsonResponse(201, []);
      if (stringUrl.includes("/rest/v1/growth_metric_snapshots") && method === "POST") {
        const body = JSON.parse(options.body);
        return jsonResponse(201, [{ id: SNAPSHOT_ID, ...body }]);
      }
      if (stringUrl === "https://analyticsdata.googleapis.com/v1beta/properties/123456:runReport") return jsonResponse(200, { metricHeaders: [{ name: "activeUsers", type: "TYPE_INTEGER" }], dimensionHeaders: [{ name: "sessionSource" }], rows: [{ dimensionValues: [{ value: "google" }], metricValues: [{ value: "42" }] }], rowCount: 1, metadata: { subjectToThresholding: true, currencyCode: "USD" } });
      return jsonResponse(200, []);
    };
    const result = await request(buildApp()).post("/api/growth/provider-jobs").send({ provider_key: "google_analytics", capability: "run_report", operation: "run_report", idempotency_key: "ga4-report-1", campaign_id: CAMPAIGN_ID, request_payload: job.request_payload });
    assert.equal(result.status, 201);
    assert.equal(result.body.job.status, "completed");
    assert.equal(result.body.snapshot.sampled, true);
    const providerCall = calls.find((call) => call.url.includes(":runReport"));
    assert.equal(providerCall.headers.Authorization, "Bearer ga4-test-token");
  });

  it("holds TikTok direct posting for approval instead of pretending it published", async () => {
    let insertedJob;
    global.fetch = async (url, options = {}) => {
      if (String(url).includes("/rest/v1/growth_provider_jobs") && options.method === "POST") {
        insertedJob = { ...providerJob({ provider_key: "tiktok_content", capability: "direct_post", operation: "direct_post", status: "approval_required", approval_required: true }), ...JSON.parse(options.body) };
        return jsonResponse(201, [insertedJob]);
      }
      if (String(url).includes("/rest/v1/growth_control_events")) return jsonResponse(201, []);
      return jsonResponse(200, []);
    };
    const result = await request(buildApp()).post("/api/growth/provider-jobs").send({ provider_key: "tiktok_content", capability: "direct_post", operation: "direct_post", idempotency_key: "tiktok-post-1", request_payload: { caption: "Approved launch post" } });
    assert.equal(result.status, 201);
    assert.equal(result.body.job.status, "approval_required");
  });
});
