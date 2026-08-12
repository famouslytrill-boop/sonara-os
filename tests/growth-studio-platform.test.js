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
  // These six pages were 302s to /api/ URLs -- catalogued in the route
  // registry, reachable from navigation, and delivering raw JSON.

  it("renders every Growth Studio record page instead of redirecting to JSON", async () => {
    global.fetch = async () => jsonResponse(200, []);
    for (const path of ["/growth-studio/segments", "/growth-studio/experiments", "/growth-studio/attribution", "/growth-studio/providers", "/growth-studio/consent", "/growth-studio/provider-jobs"]) {
      const result = await request(buildApp()).get(path).set("accept", "text/html");
      assert.equal(result.status, 200, `${path} did not render`);
      assert.match(result.headers["content-type"], /html/, `${path} is not a page`);
    }
  });

  it("says what is there in words, and says nothing when there is nothing", async () => {
    global.fetch = async () => jsonResponse(200, [{ id: JOB_ID, provider_key: "google_analytics", capability: "run_report", operation: "run_report", status: "completed", progress_percent: 100, approval_required: true, approved_at: null, created_at: "2026-01-01T00:00:00Z" }]);
    const listed = await request(buildApp()).get("/growth-studio/provider-jobs").set("accept", "text/html");
    assert.match(listed.text, /Finished/);
    assert.match(listed.text, /Waiting on you/);
    assert.doesNotMatch(listed.text, /approval_required/);

    global.fetch = async () => jsonResponse(200, []);
    const bare = await request(buildApp()).get("/growth-studio/provider-jobs").set("accept", "text/html");
    assert.match(bare.text, /Nothing has been sent to a connected service yet/);
  });

  it("keeps the totals that the metrics summary used to carry", async () => {
    // The card asks the database how many rows there are rather than counting
    // whatever fitted on a page, so this stub has to answer the way PostgREST
    // does: a Content-Range whose tail is the total when count=exact is asked
    // for. It honours the status filter too, otherwise "Campaigns" and
    // "Campaigns running" would come back identical and the test would pass
    // over a card that had stopped distinguishing them.
    const CAMPAIGNS = [{ id: CAMPAIGN_ID, status: "active" }, { id: SNAPSHOT_ID, status: "draft" }];
    const CONVERSIONS = [{ id: CONTENT_ID, value: 250 }];

    global.fetch = async (url, options = {}) => {
      const stringUrl = String(url);
      const rows = stringUrl.includes("growth_campaigns") ? CAMPAIGNS
        : stringUrl.includes("growth_conversions") ? CONVERSIONS
          : [];
      const matching = rows.filter((row) => {
        const wanted = stringUrl.match(/status=eq\.([a-z]+)/)?.[1];
        return !wanted || row.status === wanted;
      });
      if (String(options.headers?.Prefer || "").includes("count=exact")) {
        return jsonResponse(200, matching.slice(0, 1), { "content-range": `0-0/${matching.length}` });
      }
      return jsonResponse(200, matching);
    };

    const result = await request(buildApp()).get("/growth-studio/attribution").set("accept", "text/html");
    assert.match(result.text, /Your totals/);
    assert.match(result.text, /Campaigns running/);
    assert.match(result.text, /250/);
    // Attribution is what a source reported, not proof it caused the sale.
    assert.match(result.text, /not proof it caused it/);
  });

  it("counts the table rather than the page, and says so when it cannot", async () => {
    // The defect this replaced: up to 500 or 1000 rows were read and
    // rows.length was reported as the total, under a heading saying "counted
    // from your own records". A business over the cap was told it had exactly
    // the cap.
    global.fetch = async (url, options = {}) => {
      if (String(options.headers?.Prefer || "").includes("count=exact")) {
        // More rows than any page would carry.
        return jsonResponse(200, [{ id: CAMPAIGN_ID }], { "content-range": "0-0/4210" });
      }
      return jsonResponse(200, []);
    };
    const counted = await request(buildApp()).get("/growth-studio/attribution").set("accept", "text/html");
    assert.match(counted.text, /4210/, "the total came from the page rather than from the database");

    // And a count that fails is not zero. The card used to report a problem
    // only when *every* read failed, so one unreadable table left a real 0
    // sitting beside real numbers, indistinguishable from having none.
    //
    // Only the leads count fails here, deliberately. Failing all of them makes
    // the card short-circuit to "we could not count these", which renders no
    // rows at all -- so an assertion written that way passes whatever the row
    // logic does. That version of this check was written first and proved
    // nothing; it was caught by breaking the code and watching it still pass.
    global.fetch = async (url, options = {}) => {
      const counting = String(options.headers?.Prefer || "").includes("count=exact");
      if (!counting) return jsonResponse(200, []);
      if (String(url).includes("growth_leads")) return jsonResponse(500, []);
      return jsonResponse(200, [{ id: CAMPAIGN_ID }], { "content-range": "0-0/7" });
    };
    const partial = await request(buildApp()).get("/growth-studio/attribution").set("accept", "text/html");
    assert.match(partial.text, /7/, "the counts that did work are not being shown");

    // The specific row, not a blanket search for a zero anywhere on the page.
    // A blanket check fails on the money row, which honestly reads 0 when there
    // are no sales -- and a check that cannot tell an honest zero from a
    // substituted one is not checking the thing it claims to.
    const leadsRow = partial.text.match(/People who got in touch<\/th><td>([^<]*)<\/td>/);
    assert.ok(leadsRow, "the enquiries row is not on the page at all");
    assert.equal(
      leadsRow[1],
      "Not available just now",
      `a count that could not be read is being shown as "${leadsRow[1]}" rather than saying it is unavailable`
    );
  });

  it("reports metric totals from the database, and says what the value covers", async () => {
    // `totals` is the worst surface for a page length dressed as a total: an
    // API consumer has no heading to question, just a key called totals. Every
    // field there used to be rows.length from a read capped at 500 or 1000.
    global.fetch = async (url, options = {}) => {
      const counting = String(options.headers?.Prefer || "").includes("count=exact");
      if (counting) return jsonResponse(200, [{ id: CAMPAIGN_ID }], { "content-range": "0-0/3120" });
      if (String(url).includes("growth_conversions")) return jsonResponse(200, [{ id: CONTENT_ID, value: 250 }, { id: SNAPSHOT_ID, value: 50 }]);
      return jsonResponse(200, []);
    };
    const result = await request(buildApp()).get("/api/growth/metrics");
    assert.equal(result.status, 200);
    assert.equal(result.body.totals.leads, 3120, "leads came from the page rather than from the database");
    assert.equal(result.body.totals.conversions, 3120);

    // The value cannot be summed by PostgREST, so it is a sample -- and the
    // response has to say so rather than let a caller assume it is the total.
    assert.equal(result.body.totals.conversionValue, 300);
    assert.equal(result.body.computedOver.conversions, 2);
    assert.equal(result.body.computedOver.complete, false, "the response does not admit the value covers a sample");
  });

  it("returns null rather than zero for a count it could not read", async () => {
    // Zero is an answer. "We could not ask" is not the same answer, and an API
    // that returns 0 for both leaves the caller unable to tell them apart.
    global.fetch = async (url, options = {}) => {
      if (String(options.headers?.Prefer || "").includes("count=exact")) return jsonResponse(500, []);
      return jsonResponse(200, []);
    };
    const result = await request(buildApp()).get("/api/growth/metrics");
    assert.equal(result.status, 200);
    assert.equal(result.body.totals.leads, null, "an unreadable count is being reported as a number");
    assert.equal(result.body.computedOver.complete, null);
  });

  it("never puts a credential or a stored blob on a connected-services page", async () => {
    global.fetch = async () => jsonResponse(200, [{
      id: JOB_ID,
      provider_key: "google_analytics",
      external_account_id: "acct-123",
      connection_status: "connected",
      credential_reference: "vault://super-secret",
      configuration: { refresh_token: "leak-me" },
      last_verified_at: "2026-01-01T00:00:00Z"
    }]);
    const result = await request(buildApp()).get("/growth-studio/providers").set("accept", "text/html");
    assert.equal(result.status, 200);
    assert.match(result.text, /Connected/);
    assert.doesNotMatch(result.text, /super-secret/);
    assert.doesNotMatch(result.text, /leak-me/);
    assert.doesNotMatch(result.text, /acct-123/);
  });
});
