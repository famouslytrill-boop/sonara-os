"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const request = require("supertest");
const registerRoutes = require("../routes/sonara-business-control-plane-routes.cjs");
const { settledMapBounded } = require("../lib/sonara-bounded-source-reads.cjs");
const { INDUSTRIES, industryKey, makeOverview } = require("../lib/sonara-customer-business-operations.cjs");

const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const BUSINESS_ID = "33333333-3333-4333-8333-333333333333";

function businessRecord() {
  return {
    id: BUSINESS_ID,
    organization_id: ORGANIZATION_ID,
    owner_user_id: USER_ID,
    name: "Damian's Shop",
    public_name: "Damian's Shop",
    business_type: "hybrid",
    acquisition_mode: "connected",
    status: "active",
    version: 1
  };
}

describe("Business Builder control plane", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete globalThis.__sonaraBusinessControlRest;
  });

  function response(status, body) {
    return {
      ok: status >= 200 && status < 300,
      status,
      async json() { return body; }
    };
  }

  function buildApp({ paid = true, userId = USER_ID, ownerOverride = true } = {}) {
    const app = express();
    app.use(express.urlencoded({ extended: false }));
    app.use(express.json());

    registerRoutes(app, {
      layout: ({ title, heading, body, sections = [] }) => `<html><title>${title}</title><h1>${heading}</h1><p>${body}</p>${sections.join("")}</html>`,
      brandCard: (title, body) => `<article><h2>${title}</h2><p>${body}</p></article>`,
      linkAction: (href, label) => `<a href="${href}">${label}</a>`,
      escapeHtml: (value) => String(value).replace(/[&<>"']/g, ""),
      requirePaidOrOwnerAccess: () => (req, res, next) => {
        if (!paid) return res.status(402).json({ ok: false, code: "upgrade_required" });
        req.sonaraUser = { id: userId, email: "user@example.com" };
        req.sonaraAccess = { ownerOverride, roles: ownerOverride ? ["owner"] : [] };
        return next();
      },
      getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId: ORGANIZATION_ID }),
      getSupabaseServerConfig: () => ({ ok: true, url: "https://example.supabase.co", serviceRoleKey: "server-only" }),
      supabaseHeaders: () => ({ "Content-Type": "application/json" })
    });

    return app;
  }


  it("bounds independent read fanout without changing input order or leaking rejected provider details", async () => {
    let active = 0;
    let highest = 0;
    const result = await settledMapBounded(Array.from({ length: 11 }, (_, i) => i), async (item) => {
      active += 1;
      highest = Math.max(highest, active);
      try {
        await new Promise((resolve) => setTimeout(resolve, 2));
        if (item === 7) throw new Error("provider response contains private details");
        return item * 3;
      } finally {
        active -= 1;
      }
    }, { concurrency: 3 });
    assert.equal(highest, 3, "the limiter should use its capacity, not serialize all reads");
    assert.equal(active, 0);
    assert.equal(result.length, 11);
    assert.deepEqual(result.map((r) => r.ok), Array.from({ length: 11 }, (_, i) => i !== 7));
    assert.equal(result[9].value, 27, "parallel completion did not reorder results");
    assert.deepEqual(result[7], { ok: false, code: "source_unavailable" });
    assert.doesNotMatch(JSON.stringify(result), /private details/);
    assert.deepEqual(await settledMapBounded([], async () => null), []);
    await assert.rejects(() => settledMapBounded([1], () => 1, { concurrency: 0 }), RangeError);
    await assert.rejects(() => settledMapBounded([1], () => 1, { concurrency: 1.5 }), RangeError);
    await assert.rejects(() => settledMapBounded([1], () => 1, { concurrency: 999 }), RangeError);
  });

  it("limits source requests to three in each business API/dashboard fanout and preserves unavailable sources", async () => {
    let active = 0;
    let maxActive = 0;
    let queried = 0;
    global.fetch = async (url) => {
      const target = String(url);
      if (target.includes("/business_workspaces")) return response(200, [businessRecord()]);
      active += 1;
      maxActive = Math.max(maxActive, active);
      queried += 1;
      try {
        await new Promise((resolve) => setTimeout(resolve, 2));
        if (target.includes("/customer_records")) throw new Error("private database internal error");
        if (target.includes("/business_service_catalog")) {
          return response(200, [{ id: "fake-service" }]);
        }
        return response(200, []);
      } finally {
        active -= 1;
      }
    };
    const app = buildApp();
    const detail = await request(app)
      .get(`/api/business-builder/businesses/${BUSINESS_ID}`).set("Accept", "application/json");
    assert.equal(detail.status, 200);
    assert.equal(detail.body.operations.ok, true);
    assert.equal(detail.body.resources.customers, null);
    assert.ok(detail.body.unavailable.includes("customers"));
    assert.equal(detail.body.operations.metrics.find((r) => r.key === "customers").count, null);
    assert.equal(detail.body.operations.metrics.find((r) => r.key === "services").count, 1);
    assert.ok(maxActive <= 3, "per-request backend fanout exceeded the three-read budget");
    assert.ok(maxActive > 1, "bounded requests should still make progress concurrently");
    assert.ok(queried >= 7, "the API skipped required independent source reads");
    maxActive = 0;
    queried = 0;
    const page = await request(app).get(`/business-builder/businesses/${BUSINESS_ID}`);
    assert.equal(page.status, 200);
    assert.match(page.text, /Business operating overview/);
    assert.ok(maxActive <= 3, "the dashboard bypassed the three-read limit");
    assert.ok(queried >= 7);
    assert.match(page.text, /Unavailable/i);
  });


  it("registers a paid, authenticated business list endpoint", async () => {
    global.fetch = async (url) => {
      assert.match(String(url), /business_workspaces/);
      return response(200, []);
    };

    const result = await request(buildApp()).get("/api/business-builder/businesses").set("Accept", "application/json");
    assert.equal(result.status, 200);
    assert.equal(result.body.ok, true);
    assert.deepEqual(result.body.businesses, []);
  });

  it("rejects business control when paid entitlement is unavailable", async () => {
    const result = await request(buildApp({ paid: false })).get("/api/business-builder/control-plane").set("Accept", "application/json");
    assert.equal(result.status, 402);
    assert.equal(result.body.code, "upgrade_required");
  });

  it("creates a physical or online business and writes an audit event", async () => {
    const calls = [];
    global.fetch = async (url, options = {}) => {
      calls.push({ url: String(url), method: options.method || "GET", body: options.body ? JSON.parse(options.body) : undefined });
      if (String(url).includes("/rest/v1/business_workspaces") && options.method === "POST") {
        return response(201, [businessRecord()]);
      }
      if (String(url).includes("/rest/v1/business_control_audit_events")) return response(201, []);
      return response(200, []);
    };

    const result = await request(buildApp())
      .post("/api/business-builder/businesses")
      .set("Accept", "application/json")
      .send({ name: "Damian's Shop", business_type: "hybrid", acquisition_mode: "connected", website_url: "https://example.com" });

    assert.equal(result.status, 201);
    assert.equal(result.body.ok, true);
    assert.equal(result.body.business.id, BUSINESS_ID);
    const createCall = calls.find((call) => call.url.includes("business_workspaces") && call.method === "POST");
    assert.equal(createCall.body.organization_id, ORGANIZATION_ID);
    assert.equal(createCall.body.owner_user_id, USER_ID);
    assert.equal(createCall.body.business_type, "hybrid");
    assert.equal(createCall.body.acquisition_mode, "connected");
    assert.ok(calls.some((call) => call.url.includes("business_control_audit_events")));
  });

  it("keeps provider connections setup-required until commercial and operator governance passes", async () => {
    const calls = [];
    global.fetch = async (url, options = {}) => {
      const call = { url: String(url), method: options.method || "GET", body: options.body ? JSON.parse(options.body) : undefined };
      calls.push(call);
      if (call.url.includes("/rest/v1/business_workspaces") && call.method === "GET") return response(200, [businessRecord()]);
      if (call.url.includes("/rest/v1/business_integration_connections") && call.method === "POST") {
        return response(201, [{ id: "44444444-4444-4444-8444-444444444444", ...call.body }]);
      }
      if (call.url.includes("/rest/v1/business_control_audit_events")) return response(201, []);
      return response(200, []);
    };

    const refused = await request(buildApp())
      .post(`/api/business-builder/businesses/${BUSINESS_ID}/integrations`)
      .set("Accept", "application/json")
      .send({ provider_key: "calendar", connection_status: "connected" });
    assert.equal(refused.status, 409);
    assert.equal(refused.body.code, "integration_governance_required");
    assert.equal(calls.some((call) => call.url.includes("business_integration_connections") && call.method === "POST"), false);

    const oauthRefused = await request(buildApp())
      .post(`/api/business-builder/businesses/${BUSINESS_ID}/integrations`)
      .set("Accept", "application/json")
      .send({
        provider_key: "calendar",
        connection_mode: "oauth",
        connection_status: "connected",
        settings: {
          governance: {
            organizationScoped: true,
            secrets: "server_only",
            commercial: { status: "approved", termsUrl: "https://provider.example/terms", reviewedAt: "2026-09-13T12:00:00Z" },
            rateLimit: { mode: "provider_headers", honorsRetryAfter: true },
            operator: { mode: "human_approval", externalActionsAllowed: false },
            ai: { mode: "disabled", required: false }
          }
        }
      });
    assert.equal(oauthRefused.status, 409);
    assert.ok(oauthRefused.body.reasons.includes("provider_server_verification_required"));
    assert.ok(oauthRefused.body.reasons.includes("oauth_grant_verification_required"));

    const accepted = await request(buildApp())
      .post(`/api/business-builder/businesses/${BUSINESS_ID}/integrations`)
      .set("Accept", "application/json")
      .send({
        provider_key: "calendar",
        connection_status: "connected",
        settings: {
          governance: {
            organizationScoped: true,
            secrets: "server_only",
            commercial: { status: "approved", termsUrl: "https://provider.example/terms", reviewedAt: "2026-09-13T12:00:00Z" },
            rateLimit: { mode: "provider_headers", honorsRetryAfter: true },
            operator: { mode: "human_approval", externalActionsAllowed: false },
            ai: { mode: "disabled", required: false }
          }
        }
      });
    assert.equal(accepted.status, 201);
    assert.equal(accepted.body.ok, true);
    const inserted = calls.find((call) => call.url.includes("business_integration_connections") && call.method === "POST");
    assert.equal(inserted.body.organization_id, ORGANIZATION_ID);
    assert.equal(inserted.body.connection_status, "connected");
    assert.equal(inserted.body.settings.governance.secrets, "server_only");
  });

  it("opens only curated provider destinations after tenant and business re-checks", async () => {
    const CONNECTION_ID = "44444444-4444-4444-8444-444444444444";
    const calls = [];
    global.fetch = async (url, options = {}) => {
      const call = { url: String(url), method: options.method || "GET", body: options.body ? JSON.parse(options.body) : undefined };
      calls.push(call);
      if (call.url.includes("/rest/v1/business_workspaces") && call.method === "GET") return response(200, [businessRecord()]);
      if (call.url.includes("/rest/v1/business_integration_connections") && call.method === "GET") {
        assert.ok(call.url.includes(`organization_id=eq.${encodeURIComponent(ORGANIZATION_ID)}`));
        assert.ok(call.url.includes(`business_id=eq.${encodeURIComponent(BUSINESS_ID)}`));
        assert.ok(call.url.includes(`id=eq.${encodeURIComponent(CONNECTION_ID)}`));
        return response(200, [{ id: CONNECTION_ID, provider_key: "stripe", connection_mode: "manual", connection_status: "connected" }]);
      }
      if (call.url.includes("/rest/v1/business_control_audit_events")) return response(201, []);
      return response(200, []);
    };

    const result = await request(buildApp())
      .get(`/business-builder/businesses/${BUSINESS_ID}/integrations/${CONNECTION_ID}/open-provider`);

    assert.equal(result.status, 303);
    assert.equal(result.headers.location, "https://dashboard.stripe.com/");
    assert.equal(result.headers["referrer-policy"], "no-referrer");
    assert.equal(result.headers["cache-control"], "no-store");
    assert.ok(!result.headers.location.includes("token"));
    assert.ok(calls.some((call) => call.url.includes("business_control_audit_events")));
  });

  it("refuses a browser-supplied or unknown provider destination", async () => {
    const CONNECTION_ID = "44444444-4444-4444-8444-444444444444";
    global.fetch = async (url, options = {}) => {
      const target = String(url);
      if (target.includes("/rest/v1/business_workspaces") && (options.method || "GET") === "GET") return response(200, [businessRecord()]);
      if (target.includes("/rest/v1/business_integration_connections") && (options.method || "GET") === "GET") {
        return response(200, [{
          id: CONNECTION_ID,
          provider_key: "customer_supplied_evil",
          connection_mode: "oauth",
          connection_status: "connected",
          settings: { dashboard_url: "https://attacker.example/?access_token=secret" }
        }]);
      }
      if (target.includes("/rest/v1/business_control_audit_events")) return response(201, []);
      return response(200, []);
    };

    const result = await request(buildApp())
      .get(`/business-builder/businesses/${BUSINESS_ID}/integrations/${CONNECTION_ID}/open-provider`);

    assert.equal(result.status, 409);
    assert.match(result.text, /needs verification/i);
    assert.ok(!String(result.headers.location || "").includes("attacker.example"));
  });

  it("uses resource-specific lifecycle transitions for integrations and permissions", async () => {
    const scenarios = [
      {
        resource: "integrations",
        table: "business_integration_connections",
        id: "44444444-4444-4444-8444-444444444444",
        expected: { connection_status: "disabled" },
        forbiddenField: "status"
      },
      {
        resource: "permissions",
        table: "business_permission_grants",
        id: "55555555-5555-4555-8555-555555555555",
        expected: { status: "revoked" },
        forbiddenField: "connection_status"
      }
    ];

    for (const scenario of scenarios) {
      const calls = [];
      global.fetch = async (url, options = {}) => {
        const call = {
          url: String(url),
          method: options.method || "GET",
          body: options.body ? JSON.parse(options.body) : undefined
        };
        calls.push(call);
        if (call.url.includes("/rest/v1/business_workspaces") && call.method === "GET") {
          return response(200, [businessRecord()]);
        }
        if (call.url.includes(`/rest/v1/${scenario.table}`) && call.method === "PATCH") {
          return response(200, [{ id: scenario.id, business_id: BUSINESS_ID, ...scenario.expected }]);
        }
        if (call.url.includes("/rest/v1/business_control_audit_events") && call.method === "POST") {
          return response(201, []);
        }
        return response(200, []);
      };

      const result = await request(buildApp())
        .delete(`/api/business-builder/businesses/${BUSINESS_ID}/${scenario.resource}/${scenario.id}`)
        .set("Accept", "application/json");

      assert.equal(result.status, 200, scenario.resource);
      assert.equal(result.body.ok, true, scenario.resource);
      const patchCall = calls.find((call) => call.url.includes(`/rest/v1/${scenario.table}`) && call.method === "PATCH");
      assert.ok(patchCall, `${scenario.resource} patch was not issued`);
      for (const [field, value] of Object.entries(scenario.expected)) assert.equal(patchCall.body[field], value, scenario.resource);
      assert.equal(Object.hasOwn(patchCall.body, scenario.forbiddenField), false, scenario.resource);
      assert.equal(typeof patchCall.body.updated_at, "string", scenario.resource);
      assert.ok(calls.some((call) => call.url.includes("business_control_audit_events") && call.method === "POST"), scenario.resource);
    }
  });

  it("uses an allowlisted resource registry rather than arbitrary table names", () => {
    const source = fs.readFileSync(path.join(__dirname, "..", "routes", "sonara-business-control-plane-routes.cjs"), "utf8");
    assert.match(source, /const RESOURCES = Object\.freeze/);
    assert.match(source, /business_locations/);
    assert.match(source, /business_permission_grants/);
    assert.match(source, /archivePatch: \{ connection_status: "disabled" \}/);
    assert.match(source, /archivePatch: \{ status: "revoked" \}/);
    assert.doesNotMatch(source, /req\.params\.table/);
    assert.match(source, /organization_id=eq\./);
    assert.match(source, /business_id=eq\./);
  });

  it("ships tenant-scoped RLS, permissions, ownership transfer, audit, and business integrations", () => {
    const first = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "20260723060000_business_builder_control_plane.sql"), "utf8");
    const second = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "20260723060500_business_integration_connections.sql"), "utf8");
    assert.match(first, /business_permission_grants/);
    assert.match(first, /business_ownership_transfers/);
    assert.match(first, /business_control_audit_events/);
    assert.match(first, /enable row level security/);
    assert.match(first, /sonara_is_org_member/);
    assert.match(first, /is_org_owner_or_admin/);
    assert.doesNotMatch(first, /inventory_movements/);
    assert.match(second, /business_integration_connections/);
    assert.match(second, /credential_reference/);
    assert.match(second, /revoke select \(credential_reference\)/);
  });

  it("keeps business operations scoped and refuses cross-organization input before showing analytics", () => {
    const snapshot = { counts: { customers: 0 }, readable: { customers: false }, truncated: {} };
    const refusal = makeOverview({
      business: businessRecord(), userId: USER_ID, organizationId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", snapshot
    });
    assert.equal(refusal.ok, false);
    assert.equal(refusal.code, "business_scope_unverified");
    const overview = makeOverview({
      business: businessRecord(), userId: USER_ID, organizationId: ORGANIZATION_ID, snapshot
    });
    assert.equal(overview.ok, true);
    assert.equal(overview.metrics.find((item) => item.key === "customers").count, null);
    assert.equal(overview.metrics.find((item) => item.key === "customers").state, "unavailable");
    assert.ok(overview.checks.unavailableSources.includes("customers"));
    assert.notEqual(overview.checks.status, "sources_readable");
    assert.equal(overview.permission.isBusinessOwner, true);
  });

  it("offers 17 strictly allowlisted sector previews without mutating the saved business profile", () => {
    assert.equal(INDUSTRIES.length, 17);
    assert.equal(new Set(INDUSTRIES.map((row) => row.key)).size, 17);
    assert.equal(industryKey("Food Truck"), "food_truck");
    assert.equal(industryKey("rentals"), "rentals");
    assert.equal(industryKey("real-estate"), "real_estate");
    assert.equal(industryKey(["restaurant"]), null);
    assert.equal(industryKey("restaurant<script>"), null);
    const plan = makeOverview({
      business: businessRecord(), organizationId: ORGANIZATION_ID, userId: USER_ID,
      selectedIndustry: "rentals", snapshot: {}
    });
    assert.equal(plan.industry.selected, "rentals");
    assert.equal(plan.industry.savedToBusinessProfile, false);
    assert.equal(plan.industryPlans.length, 1);
    assert.equal(plan.industryPlans[0].approvalRequired, true);
    assert.equal(plan.industryPlans[0].status, "template_only");
    assert.equal(plan.industryPlans[0].externalActionsExecuted, false);
    assert.equal(plan.execution.workflowRunsStarted, 0);
    const injected = makeOverview({
      business: businessRecord(), organizationId: ORGANIZATION_ID, userId: USER_ID,
      selectedIndustry: "rentals<script>", snapshot: {}
    });
    assert.equal(injected.industry.selectionValid, false);
    assert.equal(injected.industryPlans.length, 0);
  });

  it("returns scoped, sampled, clearly incomplete business-source checks in the existing business API", async () => {
    const reads = [];
    global.fetch = async (url) => {
      const target = String(url);
      reads.push(target);
      if (target.includes("/business_workspaces")) return response(200, [businessRecord()]);
      if (target.includes("/customer_records")) return response(503, { message: "unavailable" });
      if (target.includes("/business_service_catalog")) return response(200,
        Array.from({ length: 25 }, (_, i) => ({ id: String(i) })));
      return response(200, []);
    };
    const result = await request(buildApp())
      .get(`/api/business-builder/businesses/${BUSINESS_ID}?industry=trades`)
      .set("Accept", "application/json");
    assert.equal(result.status, 200);
    assert.equal(result.body.operations.ok, true);
    assert.equal(result.body.operations.organizationId, ORGANIZATION_ID);
    assert.equal(result.body.operations.businessId, BUSINESS_ID);
    assert.equal(result.body.operations.industryPlans[0].industry, "trades");
    assert.equal(result.body.operations.execution.providerActivityPerformed, false);
    assert.equal(result.body.operations.metrics.find((x) => x.key === "customers").count, null);
    assert.equal(result.body.operations.metrics.find((x) => x.key === "services").state, "partial");
    assert.ok(result.body.operations.checks.partialSources.includes("services"));
    assert.ok(result.body.operations.checks.unavailableSources.includes("customers"));
    assert.ok(reads.some((x) => x.includes(`organization_id=eq.${encodeURIComponent(ORGANIZATION_ID)}`)
      && x.includes(`business_id=eq.${encodeURIComponent(BUSINESS_ID)}`)));
  });

  it("renders an accessible industry selector with owner-only advanced links but no run button", async () => {
    global.fetch = async (url) => {
      if (String(url).includes("/business_workspaces")) return response(200, [businessRecord()]);
      return response(200, []);
    };
    const result = await request(buildApp()).get(`/business-builder/businesses/${BUSINESS_ID}?industry=rentals`);
    assert.equal(result.status, 200);
    assert.match(result.text, /Business operating overview/);
    assert.match(result.text, /label for="sonara-business-industry"/);
    assert.match(result.text, /Preview workflows/);
    assert.match(result.text, /Planning only/);
    assert.match(result.text, /Owner approval required/);
    assert.match(result.text, /Manage business permissions/);
    assert.doesNotMatch(result.text, /<button[^>]*>Execute workflow<\/button>/i);
  });

  it("denies a member without business.read and hides owner controls from a member who has it", async () => {
    const other = "99999999-9999-4999-8999-999999999999";
    let grant = false;
    global.fetch = async (url) => {
      const target = String(url);
      if (target.includes("/business_workspaces")) return response(200, [businessRecord()]);
      if (target.includes("/business_permission_grants")) return response(200,
        grant ? [{ permission_key: "business.read", status: "active", expires_at: null }] : []);
      return response(200, []);
    };
    const app = buildApp({ userId: other, ownerOverride: false });
    const denied = await request(app).get(`/api/business-builder/businesses/${BUSINESS_ID}?industry=retail`);
    assert.equal(denied.status, 403);
    assert.equal(denied.body.code, "business_permission_denied");
    grant = true;
    const granted = await request(app).get(`/api/business-builder/businesses/${BUSINESS_ID}?industry=retail`);
    assert.equal(granted.status, 200);
    assert.equal(granted.body.operations.permission.isBusinessOwner, false);
    assert.equal(granted.body.operations.permission.canManagePermissions, false);
    assert.equal(granted.body.operations.destinations.permissions, null);
    const html = await request(app).get(`/business-builder/businesses/${BUSINESS_ID}?industry=retail`);
    assert.equal(html.status, 200);
    assert.match(html.text, /Only the verified business owner/);
    assert.doesNotMatch(html.text, /Transfer ownership/i, "delegated readers must not see ownership transfer controls");
  });

});
