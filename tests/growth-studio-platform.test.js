"use strict";

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const registerRoutes = require("../routes/growth-studio-control-routes.cjs");

const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const CAMPAIGN_ID = "33333333-3333-4333-8333-333333333333";
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

function createProviderFetch({ initialJob, providerUrl, providerResponse, providerStatus = 200, onProvider }) {
  let job = initialJob;
  return async (url, options = {}) => {
    const stringUrl = String(url);
    const method = options.method || "GET";
    if (stringUrl.includes("/rest/v1/growth_provider_jobs") && method === "POST") {
      job = { ...job, ...JSON.parse(options.body) };
      return jsonResponse(201, [job]);
    }
    if (stringUrl.includes("/rest/v1/growth_provider_jobs") && method === "PATCH") {
      job = { ...job, ...JSON.parse(options.body) };
      return jsonResponse(200, [job]);
    }
    if (stringUrl.includes("/rest/v1/growth_control_events")) return jsonResponse(201, []);
    if (stringUrl === providerUrl) {
      if (onProvider) onProvider(options);
      return providerStatus === 202 || providerStatus === 204 ? emptyResponse(providerStatus) : jsonResponse(providerStatus, providerResponse || {});
    }
    return jsonResponse(200, []);
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

  it("creates tenant-scoped campaigns and append-only events", async () => {
    const calls = [];
    global.fetch = async (url, options = {}) => {
      const stringUrl = String(url);
      const body = options.body ? JSON.parse(options.body) : null;
      calls.push({ url: stringUrl, method: options.method || "GET", body });
      if (stringUrl.includes("/rest/v1/growth_campaigns") && options.method === "POST") return jsonResponse(201, [{ id: CAMPAIGN_ID, ...body }]);
      if (stringUrl.includes("/rest/v1/growth_control_events")) return jsonResponse(201, []);
      return jsonResponse(200, []);
    };
    const result = await request(buildApp()).post("/api/growth/campaigns").send({ name: "Neighborhood launch", goal: "Qualified consultations", channel: "multi_channel" });
    assert.equal(result.status, 201);
    assert.equal(result.body.campaign.organization_id, ORGANIZATION_ID);
    assert.equal(calls.find((call) => call.url.includes("growth_control_events")).body.event_type, "campaign.created");
  });

  it("enforces tracking, consent, publishing, and automation safety boundaries", async () => {
    const touchpoint = await request(buildApp()).post("/api/growth/touchpoints").send({ event_name: "landing_page_view" });
    assert.equal(touchpoint.body.code, "tracking_basis_attestation_required");

    const lifecycleContent = await request(buildApp()).post("/api/growth/content").send({ channel: "email", content_type: "email", title: "Follow-up" });
    assert.equal(lifecycleContent.body.code, "audience_consent_basis_required");

    global.fetch = async (url, options = {}) => {
      if (String(url).includes("/rest/v1/growth_content_queue") && (options.method || "GET") === "GET") return jsonResponse(200, [{ id: CONTENT_ID, organization_id: ORGANIZATION_ID, campaign_id: CAMPAIGN_ID, channel: "tiktok", content_type: "social_post" }]);
      return jsonResponse(200, []);
    };
    const publish = await request(buildApp()).post(`/api/growth/content/${CONTENT_ID}/publish`).send({ provider_key: "tiktok_content", operation: "direct_post" });
    assert.equal(publish.body.code, "explicit_publish_approval_required");

    const automation = await request(buildApp()).post("/api/growth/automations").send({ trigger_key: "lead_created", action_key: "send_webhook", config: { transform: "require('child_process').exec('whoami')" } });
    assert.equal(automation.body.code, "arbitrary_automation_code_prohibited");
  });

  it("creates allowlisted automations disabled by default", async () => {
    global.fetch = async (url, options = {}) => {
      if (String(url).includes("/rest/v1/automation_rules") && options.method === "POST") return jsonResponse(201, [{ id: "88888888-8888-4888-8888-888888888888", ...JSON.parse(options.body) }]);
      return jsonResponse(200, []);
    };
    const result = await request(buildApp()).post("/api/growth/automations").send({ trigger_key: "lead_qualified", action_key: "notify_owner", config: { channel: "in_app" } });
    assert.equal(result.status, 201);
    assert.equal(result.body.automation.status, "disabled");
  });

  it("dispatches HubSpot campaigns through the documented 2026-03 endpoint", async () => {
    process.env.HUBSPOT_ENABLED = "true";
    process.env.HUBSPOT_ACCESS_TOKEN = "hubspot-test-token";
    let providerOptions;
    global.fetch = createProviderFetch({
      initialJob: providerJob(),
      providerUrl: "https://api.hubapi.com/marketing/campaigns/2026-03",
      providerStatus: 201,
      providerResponse: { id: "hubspot-campaign-1", properties: { hs_name: "Launch campaign" } },
      onProvider: (options) => { providerOptions = options; }
    });
    const result = await request(buildApp()).post("/api/growth/provider-jobs").send({ provider_key: "hubspot", capability: "campaign_create", operation: "campaign_create", idempotency_key: "hubspot-campaign-1", campaign_id: CAMPAIGN_ID, request_payload: { name: "Launch campaign" } });
    assert.equal(result.body.job.status, "completed");
    assert.equal(providerOptions.headers.Authorization, "Bearer hubspot-test-token");
    assert.deepEqual(JSON.parse(providerOptions.body), { properties: { hs_name: "Launch campaign" } });
  });

  it("submits deduplicated Klaviyo events using the current revision", async () => {
    process.env.KLAVIYO_ENABLED = "true";
    process.env.KLAVIYO_PRIVATE_API_KEY = "klaviyo-test-key";
    let providerOptions;
    global.fetch = createProviderFetch({
      initialJob: providerJob({ provider_key: "klaviyo", capability: "event_create", operation: "event_create", request_payload: { email: "lead@example.com", metric_name: "Qualified Lead" } }),
      providerUrl: "https://a.klaviyo.com/api/events",
      providerStatus: 202,
      onProvider: (options) => { providerOptions = options; }
    });
    const result = await request(buildApp()).post("/api/growth/provider-jobs").send({ provider_key: "klaviyo", capability: "event_create", operation: "event_create", idempotency_key: "klaviyo-event-1", request_payload: { email: "lead@example.com", metric_name: "Qualified Lead" } });
    assert.equal(result.body.job.status, "completed");
    assert.equal(providerOptions.headers.revision, "2026-04-15");
    assert.equal(JSON.parse(providerOptions.body).data.attributes.unique_id, "klaviyo-event-1");
  });

  it("captures PostHog events without exposing the project key", async () => {
    process.env.POSTHOG_ENABLED = "true";
    process.env.POSTHOG_PROJECT_API_KEY = "phc_test_secret";
    global.fetch = createProviderFetch({
      initialJob: providerJob({ provider_key: "posthog", capability: "event_capture", operation: "event_capture", request_payload: { event: "consultation_booked", distinct_id: "lead-123" } }),
      providerUrl: "https://us.i.posthog.com/capture/",
      providerResponse: { status: 1 }
    });
    const result = await request(buildApp()).post("/api/growth/provider-jobs").send({ provider_key: "posthog", capability: "event_capture", operation: "event_capture", idempotency_key: "posthog-event-1", request_payload: { event: "consultation_booked", distinct_id: "lead-123" } });
    assert.equal(result.body.job.status, "completed");
    assert.doesNotMatch(JSON.stringify(result.body), /phc_test_secret/);
  });

  it("stores GA4 reports with sampling and freshness evidence", async () => {
    process.env.GA4_ENABLED = "true";
    process.env.GA4_PROPERTY_ID = "123456";
    process.env.GA4_ACCESS_TOKEN = "ga4-test-token";
    let job = providerJob({ provider_key: "google_analytics", capability: "run_report", operation: "run_report", request_payload: { report: { dateRanges: [{ startDate: "2026-07-01", endDate: "2026-07-22" }], metrics: [{ name: "activeUsers" }] } } });
    global.fetch = async (url, options = {}) => {
      const stringUrl = String(url);
      const method = options.method || "GET";
      if (stringUrl.includes("/rest/v1/growth_provider_jobs") && method === "POST") {
        job = { ...job, ...JSON.parse(options.body) };
        return jsonResponse(201, [job]);
      }
      if (stringUrl.includes("/rest/v1/growth_provider_jobs") && method === "PATCH") {
        job = { ...job, ...JSON.parse(options.body) };
        return jsonResponse(200, [job]);
      }
      if (stringUrl.includes("/rest/v1/growth_control_events")) return jsonResponse(201, []);
      if (stringUrl.includes("/rest/v1/growth_metric_snapshots") && method === "POST") return jsonResponse(201, [{ id: SNAPSHOT_ID, ...JSON.parse(options.body) }]);
      if (stringUrl === "https://analyticsdata.googleapis.com/v1beta/properties/123456:runReport") return jsonResponse(200, { metricHeaders: [{ name: "activeUsers" }], rows: [{ metricValues: [{ value: "42" }] }], rowCount: 1, metadata: { subjectToThresholding: true, currencyCode: "USD" } });
      return jsonResponse(200, []);
    };
    const result = await request(buildApp()).post("/api/growth/provider-jobs").send({ provider_key: "google_analytics", capability: "run_report", operation: "run_report", idempotency_key: "ga4-report-1", campaign_id: CAMPAIGN_ID, request_payload: job.request_payload });
    assert.equal(result.body.job.status, "completed");
    assert.equal(result.body.snapshot.sampled, true);
  });

  it("holds TikTok direct posting instead of claiming publication", async () => {
    global.fetch = async (url, options = {}) => {
      if (String(url).includes("/rest/v1/growth_provider_jobs") && options.method === "POST") return jsonResponse(201, [{ ...providerJob({ provider_key: "tiktok_content", capability: "direct_post", operation: "direct_post" }), ...JSON.parse(options.body) }]);
      if (String(url).includes("/rest/v1/growth_control_events")) return jsonResponse(201, []);
      return jsonResponse(200, []);
    };
    const result = await request(buildApp()).post("/api/growth/provider-jobs").send({ provider_key: "tiktok_content", capability: "direct_post", operation: "direct_post", idempotency_key: "tiktok-post-1", request_payload: { caption: "Launch" } });
    assert.equal(result.body.job.status, "approval_required");
  });
});
