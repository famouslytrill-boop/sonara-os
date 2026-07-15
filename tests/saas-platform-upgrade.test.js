const request = require("supertest");
const assert = require("assert");
const fs = require("node:fs");
const path = require("node:path");
const app = require("../server");

const SUPABASE_KEYS = [
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY"
];

function snapshotEnv(keys) {
  return Object.fromEntries(keys.map((key) => [key, process.env[key]]));
}

function restoreEnv(snapshot) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function clearSupabaseEnv() {
  for (const key of SUPABASE_KEYS) delete process.env[key];
}

function setSupabaseEnv() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-placeholder";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-placeholder";
}

const CUSTOMER_USER = { id: "00000000-0000-0000-0000-000000000201", email: "customer@example.com" };
const ORGANIZATION_ID = "00000000-0000-0000-0000-00000000ab01";

function customerFetchMock(overrides = {}) {
  return async (url, options = {}) => {
    const address = String(url);
    for (const [needle, handler] of Object.entries(overrides)) {
      if (address.includes(needle)) return handler(address, options);
    }
    if (address.includes("/auth/v1/user")) {
      return { ok: true, json: async () => CUSTOMER_USER };
    }
    return { ok: false, json: async () => [] };
  };
}

function organizationMembershipHandler() {
  return { ok: true, json: async () => [{ organization_id: ORGANIZATION_ID }] };
}

describe("software-in-a-service platform upgrade", () => {
  describe("deployment configuration", () => {
    it("vercel.json is valid and includeFiles is a string glob", function() {
      const config = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "vercel.json"), "utf8"));
      assert.equal(config.version, 2);
      assert.equal(typeof config.functions["api/index.js"].includeFiles, "string");
      assert.ok(Array.isArray(config.rewrites));
      assert.ok(config.rewrites.some((rule) => rule.destination === "/api"));
    });

    it("service lifecycle migration creates the required tables", function() {
      const sql = fs.readFileSync(
        path.join(__dirname, "..", "supabase", "migrations", "20260714120000_sonara_service_lifecycle_runtime_tables.sql"),
        "utf8"
      );
      for (const table of [
        "service_catalog_items",
        "service_requests",
        "service_request_events",
        "service_deliverables",
        "service_comments",
        "module_outputs",
        "billing_subscriptions",
        "billing_entitlements",
        "billing_webhook_events",
        "user_roles",
        "business_memberships",
        "business_employee_invites"
      ]) {
        assert.match(sql, new RegExp(`create table if not exists public\\.${table}`), `${table} missing from migration`);
      }
    });

    it("support delivery migration matches the server-side email audit contract", function() {
      const sql = fs.readFileSync(
        path.join(__dirname, "..", "supabase", "migrations", "20260715110223_support_delivery_state.sql"),
        "utf8"
      );
      for (const field of ["reference_id", "consent_accepted", "email_delivery_status", "email_error_summary", "email_retry_count"]) {
        assert.match(sql, new RegExp(`add column if not exists ${field}`), `${field} missing from support delivery migration`);
      }
      assert.match(sql, /create table if not exists public\.support_email_delivery_attempts/);
      assert.match(sql, /enable row level security/);

      const rlsSql = fs.readFileSync(
        path.join(__dirname, "..", "supabase", "migrations", "20260603090000_production_auth_workspace_rls.sql"),
        "utf8"
      );
      assert.match(rlsSql, /is_org_member\(target_organization_id uuid\)/);
      assert.match(rlsSql, /has_org_role\(target_organization_id uuid, allowed_roles text\[\]\)/);
    });
  });

  describe("public software-in-a-service pages", () => {
    it("homepage uses Software-in-a-Service language and links the service workflow", async function() {
      const res = await request(app).get("/").set("Accept", "text/html");
      assert.equal(res.status, 200);
      assert.match(res.text, /Software-in-a-Service/);
      assert.match(res.text, /href="\/start"/);
      assert.match(res.text, /href="\/service-catalog"/);
      assert.match(res.text, /href="\/requests"/);
      assert.match(res.text, /href="\/deliverables"/);
    });

    for (const route of [
      "/start",
      "/service-catalog",
      "/readiness",
      "/legal",
      "/support",
      "/business-builder/start",
      "/business-builder/tools",
      "/business-builder/catalog",
      "/business-builder/support",
      "/creator-studio/start",
      "/creator-studio/tools",
      "/creator-studio/support",
      "/growth-studio/start",
      "/growth-studio/tools",
      "/growth-studio/catalog",
      "/growth-studio/support"
    ]) {
      it(`GET ${route} returns 200 without placeholder or encoding problems`, async function() {
        const res = await request(app).get(route).set("Accept", "text/html");
        assert.equal(res.status, 200);
        assert.equal(res.type, "text/html");
        assert.doesNotMatch(res.text, /\[To be added\]/);
        assert.doesNotMatch(res.text, /lorem/i);
        assert.doesNotMatch(res.text, /href="#"/i);
        assert.doesNotMatch(res.text, /â€¢|BusinessCreatorGrowth/);
        assert.doesNotMatch(res.text, /SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|RESEND_API_KEY/);
      });
    }

    it("service catalog renders the standard catalog with setup language when no database is configured", async function() {
      const snapshot = snapshotEnv(SUPABASE_KEYS);
      clearSupabaseEnv();
      try {
        const res = await request(app).get("/service-catalog").set("Accept", "text/html");
        assert.equal(res.status, 200);
        assert.match(res.text, /Request this service/);
        assert.match(res.text, /service_catalog_items/);
        assert.match(res.text, /Setup required/);
      } finally {
        restoreEnv(snapshot);
      }
    });

    it("product tools directories list the free tools", async function() {
      const res = await request(app).get("/business-builder/tools").set("Accept", "text/html");
      assert.equal(res.status, 200);
      assert.match(res.text, /Offer Outline Generator/);
      assert.match(res.text, /Pricing Calculator/);
      assert.match(res.text, /Business Readiness Score/);
      assert.match(res.text, /Service Package Builder/);
      assert.match(res.text, /Customer Record Starter/);
      const creator = await request(app).get("/creator-studio/tools").set("Accept", "text/html");
      assert.match(creator.text, /Creator Profile Outline/);
      assert.match(creator.text, /Prompt and Brief Builder/);
      assert.match(creator.text, /Release Checklist Builder/);
      assert.match(creator.text, /Music System Blueprint/);
      assert.match(creator.text, /Basic Content Plan/);
      const growth = await request(app).get("/growth-studio/tools").set("Accept", "text/html");
      assert.match(growth.text, /Campaign Outline/);
      assert.match(growth.text, /Lead Follow-Up Script/);
      assert.match(growth.text, /Offer Angle Generator/);
      assert.match(growth.text, /Simple KPI Calculator/);
      assert.match(growth.text, /Growth Readiness Score/);
    });
  });

  describe("customer service request tracking", () => {
    it("GET /requests and /deliverables redirect anonymous browsers to /login", async function() {
      const snapshot = snapshotEnv(SUPABASE_KEYS);
      clearSupabaseEnv();
      try {
        for (const route of ["/requests", "/deliverables", "/business-builder/deliverables"]) {
          const res = await request(app).get(route).set("Accept", "text/html");
          assert.equal(res.status, 303, `${route} should redirect`);
          assert.equal(res.headers.location, "/login");
        }
      } finally {
        restoreEnv(snapshot);
      }
    });

    it("POST /service-requests returns setup_required naming supabase_auth when Supabase is missing", async function() {
      const snapshot = snapshotEnv(SUPABASE_KEYS);
      clearSupabaseEnv();
      try {
        const res = await request(app)
          .post("/service-requests")
          .set("Accept", "application/json")
          .send({ productKey: "business_builder", serviceName: "Launch Website Setup", summary: "Need a site", details: "Full details of the request." });
        assert.equal(res.status, 503);
        assert.equal(res.body.code, "setup_required");
        assert.equal(res.body.service, "supabase_auth");
      } finally {
        restoreEnv(snapshot);
      }
    });

    it("POST /service-requests validates required fields", async function() {
      const snapshot = snapshotEnv(SUPABASE_KEYS);
      setSupabaseEnv();
      const originalFetch = global.fetch;
      global.fetch = customerFetchMock();
      try {
        const res = await request(app)
          .post("/service-requests")
          .set("Authorization", "Bearer customer-session")
          .set("Accept", "application/json")
          .send({ productKey: "business_builder" });
        assert.equal(res.status, 400);
        assert.equal(res.body.code, "validation_failed");
        assert.ok(res.body.missing.includes("serviceName"));
      } finally {
        global.fetch = originalFetch;
        restoreEnv(snapshot);
      }
    });

    it("POST /service-requests requires an organization membership and names the dependency", async function() {
      const snapshot = snapshotEnv(SUPABASE_KEYS);
      setSupabaseEnv();
      const originalFetch = global.fetch;
      global.fetch = customerFetchMock();
      try {
        const res = await request(app)
          .post("/service-requests")
          .set("Authorization", "Bearer customer-session")
          .set("Accept", "application/json")
          .send({ productKey: "business_builder", serviceName: "Launch Website Setup", summary: "Need a site", details: "Full details of the request." });
        assert.equal(res.status, 503);
        assert.equal(res.body.code, "setup_required");
        assert.equal(res.body.service, "customer_organization");
      } finally {
        global.fetch = originalFetch;
        restoreEnv(snapshot);
      }
    });

    it("POST /service-requests names the service_requests table when the insert is unavailable", async function() {
      const snapshot = snapshotEnv(SUPABASE_KEYS);
      setSupabaseEnv();
      const originalFetch = global.fetch;
      global.fetch = customerFetchMock({
        "/rest/v1/organization_memberships": organizationMembershipHandler
      });
      try {
        const res = await request(app)
          .post("/service-requests")
          .set("Authorization", "Bearer customer-session")
          .set("Accept", "application/json")
          .send({ productKey: "business_builder", serviceName: "Launch Website Setup", summary: "Need a site", details: "Full details of the request." });
        assert.equal(res.status, 200);
        assert.equal(res.body.saved, false);
        assert.equal(res.body.code, "setup_required");
        assert.equal(res.body.service, "service_requests");
        assert.ok(res.body.referenceId);
      } finally {
        global.fetch = originalFetch;
        restoreEnv(snapshot);
      }
    });

    it("POST /service-requests saves a real record and returns the reference ID when tables exist", async function() {
      const snapshot = snapshotEnv(SUPABASE_KEYS);
      setSupabaseEnv();
      const inserts = [];
      const originalFetch = global.fetch;
      global.fetch = customerFetchMock({
        "/rest/v1/organization_memberships": organizationMembershipHandler,
        "/rest/v1/service_requests": (address, options) => {
          inserts.push(JSON.parse(options.body));
          return { ok: true, json: async () => [{ id: "00000000-0000-0000-0000-00000000cd01" }] };
        },
        "/rest/v1/service_request_events": () => ({ ok: true, json: async () => [] }),
        "/rest/v1/activity_events": () => ({ ok: true, json: async () => [] })
      });
      try {
        const res = await request(app)
          .post("/service-requests")
          .set("Authorization", "Bearer customer-session")
          .set("Accept", "application/json")
          .send({ productKey: "business_builder", serviceName: "Launch Website Setup", summary: "Need a site", details: "Full details of the request." });
        assert.equal(res.status, 200);
        assert.equal(res.body.saved, true);
        assert.equal(res.body.referenceId, "00000000-0000-0000-0000-00000000cd01");
        assert.equal(res.body.status, "submitted");
        assert.equal(inserts.length, 1);
        assert.equal(inserts[0].organization_id, ORGANIZATION_ID);
        assert.equal(inserts[0].status, "submitted");
      } finally {
        global.fetch = originalFetch;
        restoreEnv(snapshot);
      }
    });

    it("GET /requests shows saved requests for the customer organization", async function() {
      const snapshot = snapshotEnv(SUPABASE_KEYS);
      setSupabaseEnv();
      const originalFetch = global.fetch;
      global.fetch = customerFetchMock({
        "/rest/v1/organization_memberships": organizationMembershipHandler,
        "/rest/v1/service_requests": () => ({
          ok: true,
          json: async () => [{ id: "00000000-0000-0000-0000-00000000cd02", service_name: "Launch Website Setup", product_key: "business_builder", status: "in_review", created_at: "2026-07-14T00:00:00Z" }]
        })
      });
      try {
        const res = await request(app).get("/requests").set("Authorization", "Bearer customer-session").set("Accept", "text/html");
        assert.equal(res.status, 200);
        assert.match(res.text, /Launch Website Setup/);
        assert.match(res.text, /In review/);
        assert.match(res.text, /New service request/);
      } finally {
        global.fetch = originalFetch;
        restoreEnv(snapshot);
      }
    });
  });

  describe("support center", () => {
    it("POST /support/request validates input", async function() {
      const res = await request(app)
        .post("/support/request")
        .set("Accept", "application/json")
        .send({ name: "A", email: "not-an-email", subject: "", message: "short", category: "support" });
      assert.equal(res.status, 400);
      assert.equal(res.body.code, "validation_failed");
    });

    it("POST /support/request uses the safe fallback queue with a reference ID when database is missing", async function() {
      const snapshot = snapshotEnv(SUPABASE_KEYS);
      clearSupabaseEnv();
      try {
        const res = await request(app)
          .post("/support/request")
          .set("Accept", "application/json")
          .send({ name: "Casey Customer", email: "casey@example.com", subject: "Access question", message: "I need help understanding workspace setup.", category: "support", consent: "yes" });
        assert.equal(res.status, 200);
        assert.equal(res.body.ok, true);
        assert.ok(res.body.referenceId);
        assert.match(res.body.message, /Reference ID/);
      } finally {
        restoreEnv(snapshot);
      }
    });

    it("POST /support/request writes the normalized support schema and delivery audit state", async function() {
      const keys = [...SUPABASE_KEYS, "RESEND_API_KEY", "RESEND_FROM_EMAIL", "SUPPORT_TO_EMAIL", "CONTACT_TO_EMAIL"];
      const snapshot = snapshotEnv(keys);
      const originalFetch = global.fetch;
      let saved;
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon_support_status_key_1234567890";
      process.env.SUPABASE_SERVICE_ROLE_KEY = "service_role_support_status_key_1234567890";
      delete process.env.RESEND_API_KEY;
      delete process.env.RESEND_FROM_EMAIL;
      delete process.env.SUPPORT_TO_EMAIL;
      delete process.env.CONTACT_TO_EMAIL;
      global.fetch = customerFetchMock({
        "/rest/v1/support_requests": (address, options) => {
          if (options.method === "POST") {
            saved = JSON.parse(options.body);
            return { ok: true, json: async () => [{ id: "00000000-0000-0000-0000-00000000ef01" }] };
          }
          return { ok: true, json: async () => [] };
        },
        "/rest/v1/support_email_delivery_attempts": () => ({ ok: true, json: async () => [] })
      });
      try {
        const res = await request(app)
          .post("/support/request")
          .set("Accept", "application/json")
          .send({ name: "Casey Customer", email: "casey@example.com", subject: "Access question", message: "I need help understanding workspace setup.", category: "support", consent: "yes" });
        assert.equal(res.status, 200);
        assert.equal(saved.category, "technical_support");
        assert.equal(saved.name, "Casey Customer");
        assert.equal(saved.email, "casey@example.com");
        assert.equal(saved.subject, "Access question");
        assert.equal(saved.status, "new");
        assert.equal(saved.consent_accepted, true);
        assert.ok(saved.reference_id);
        assert.equal(saved.requester_email, undefined);
        assert.equal(saved.message_preview, undefined);
      } finally {
        global.fetch = originalFetch;
        restoreEnv(snapshot);
      }
    });
  });

  describe("free tools", () => {
    it("tool pages require login for anonymous browsers", async function() {
      const snapshot = snapshotEnv(SUPABASE_KEYS);
      clearSupabaseEnv();
      try {
        for (const route of ["/business-builder/tools/pricing", "/creator-studio/tools/brief", "/growth-studio/tools/kpi"]) {
          const res = await request(app).get(route).set("Accept", "text/html");
          assert.equal(res.status, 303, `${route} should redirect anonymous browsers`);
          assert.equal(res.headers.location, "/login");
        }
      } finally {
        restoreEnv(snapshot);
      }
    });

    it("tool POST routes validate required fields", async function() {
      const snapshot = snapshotEnv(SUPABASE_KEYS);
      setSupabaseEnv();
      const originalFetch = global.fetch;
      global.fetch = customerFetchMock();
      try {
        for (const [route, body] of [
          ["/business-builder/tools/offer", {}],
          ["/business-builder/tools/pricing", { costBasis: "100" }],
          ["/business-builder/tools/readiness", { businessProfile: "yes" }],
          ["/creator-studio/tools/brief", { projectType: "video" }],
          ["/creator-studio/tools/release-checklist", {}],
          ["/creator-studio/tools/music-blueprint", { workingTitle: "Song" }],
          ["/growth-studio/tools/campaign", { goal: "Leads" }],
          ["/growth-studio/tools/lead-followup", {}],
          ["/growth-studio/tools/readiness", {}]
        ]) {
          const res = await request(app).post(route).set("Accept", "application/json").send(body);
          assert.equal(res.status, 400, `${route} should reject missing fields`);
          assert.equal(res.body.code, "validation_failed");
        }
      } finally {
        global.fetch = originalFetch;
        restoreEnv(snapshot);
      }
    });

    it("pricing calculator rejects non-numeric input", async function() {
      const snapshot = snapshotEnv(SUPABASE_KEYS);
      setSupabaseEnv();
      const originalFetch = global.fetch;
      global.fetch = customerFetchMock();
      try {
        const res = await request(app)
          .post("/business-builder/tools/pricing")
          .set("Authorization", "Bearer customer-session")
          .set("Accept", "application/json")
          .send({ costBasis: "abc", hoursPerUnit: "2", hourlyRate: "50", targetMargin: "30" });
        assert.equal(res.status, 400);
        assert.equal(res.body.code, "validation_failed");
      } finally {
        global.fetch = originalFetch;
        restoreEnv(snapshot);
      }
    });

    it("pricing calculator returns deterministic output and honest save state without database tables", async function() {
      const snapshot = snapshotEnv(SUPABASE_KEYS);
      setSupabaseEnv();
      const originalFetch = global.fetch;
      global.fetch = customerFetchMock({
        "/rest/v1/organization_memberships": organizationMembershipHandler
      });
      try {
        const res = await request(app)
          .post("/business-builder/tools/pricing")
          .set("Authorization", "Bearer customer-session")
          .set("Accept", "application/json")
          .send({ costBasis: "100", hoursPerUnit: "2", hourlyRate: "50", targetMargin: "50" });
        assert.equal(res.status, 200);
        assert.equal(res.body.ok, true);
        assert.equal(res.body.saved, false);
        assert.equal(res.body.code, "setup_required");
        assert.match(res.body.output.baseCost, /\$200\.00/);
        assert.match(res.body.output.targetPrice, /\$400\.00/);
        assert.ok(res.body.referenceId);
      } finally {
        global.fetch = originalFetch;
        restoreEnv(snapshot);
      }
    });

    it("tool browser submits render the output and the save requires setup message", async function() {
      const snapshot = snapshotEnv(SUPABASE_KEYS);
      setSupabaseEnv();
      const originalFetch = global.fetch;
      global.fetch = customerFetchMock({
        "/rest/v1/organization_memberships": organizationMembershipHandler
      });
      try {
        const res = await request(app)
          .post("/growth-studio/tools/lead-followup")
          .set("Authorization", "Bearer customer-session")
          .set("Accept", "text/html")
          .type("form")
          .send({ leadName: "Jordan", service: "Growth audit", lastTouch: "call on Tuesday", consentStatus: "opted_in" });
        assert.equal(res.status, 200);
        assert.equal(res.type, "text/html");
        assert.match(res.text, /Save requires account database setup\./);
        assert.match(res.text, /Jordan/);
        assert.match(res.text, /Reference ID/);
      } finally {
        global.fetch = originalFetch;
        restoreEnv(snapshot);
      }
    });

    it("tool outputs save as module outputs when the account database accepts them", async function() {
      const snapshot = snapshotEnv(SUPABASE_KEYS);
      setSupabaseEnv();
      const inserts = [];
      const originalFetch = global.fetch;
      global.fetch = customerFetchMock({
        "/rest/v1/organization_memberships": organizationMembershipHandler,
        "/rest/v1/module_outputs": (address, options) => {
          inserts.push(JSON.parse(options.body));
          return { ok: true, json: async () => [{ id: "module-output-77" }] };
        }
      });
      try {
        const res = await request(app)
          .post("/creator-studio/tools/brief")
          .set("Authorization", "Bearer customer-session")
          .set("Accept", "application/json")
          .send({ projectType: "short video", audience: "new listeners", message: "Introduce the new release", tone: "warm" });
        assert.equal(res.status, 200);
        assert.equal(res.body.saved, true);
        assert.equal(res.body.referenceId, "module-output-77");
        assert.equal(inserts[0].product_key, "creator_studio");
        assert.equal(inserts[0].module_key, "brief_builder");
      } finally {
        global.fetch = originalFetch;
        restoreEnv(snapshot);
      }
    });
  });

  describe("admin and operator protection", () => {
    for (const route of ["/admin/requests", "/admin/deliverables", "/admin/workspaces", "/admin/ai-gateway"]) {
      it(`GET ${route} requires founder access for API clients`, async function() {
        const res = await request(app).get(route).set("Accept", "application/json");
        assert.ok([401, 503].includes(res.status), `${route} must not render for anonymous API clients`);
        assert.equal(res.body.ok, false);
      });
    }

    it("POST /admin/deliverables requires founder access", async function() {
      const res = await request(app)
        .post("/admin/deliverables")
        .set("Accept", "application/json")
        .send({ organizationId: ORGANIZATION_ID, title: "Launch package", productKey: "business_builder", status: "delivered" });
      assert.ok([401, 503].includes(res.status));
      assert.equal(res.body.ok, false);
    });
  });

  describe("optional AI gateway", () => {
    const { getOptionalAiGatewayReadiness, AI_GATEWAY_ENV_KEYS } = require("../lib/optional-ai-gateway.cjs");
    const GATEWAY_KEYS = [...AI_GATEWAY_ENV_KEYS.baseUrl, ...AI_GATEWAY_ENV_KEYS.apiKey];

    it("reports not_configured without environment values and never exposes key values", function() {
      const snapshot = snapshotEnv(GATEWAY_KEYS);
      for (const key of GATEWAY_KEYS) delete process.env[key];
      try {
        const readiness = getOptionalAiGatewayReadiness();
        assert.equal(readiness.enabled, false);
        assert.equal(readiness.status, "not_configured");
      } finally {
        restoreEnv(snapshot);
      }
    });

    it("reports configured state with only the host, never the key", function() {
      const snapshot = snapshotEnv(GATEWAY_KEYS);
      for (const key of GATEWAY_KEYS) delete process.env[key];
      process.env.SONARA_AI_GATEWAY_URL = "http://localhost:8085";
      process.env.SONARA_AI_GATEWAY_KEY = "gateway-secret-value";
      try {
        const readiness = getOptionalAiGatewayReadiness();
        assert.equal(readiness.enabled, true);
        assert.equal(readiness.status, "configured");
        assert.equal(readiness.baseUrlHost, "localhost:8085");
        assert.equal(readiness.keyConfigured, true);
        assert.ok(!JSON.stringify(readiness).includes("gateway-secret-value"));
      } finally {
        restoreEnv(snapshot);
      }
    });

    it("flags placeholder URLs as invalid", function() {
      const snapshot = snapshotEnv(GATEWAY_KEYS);
      for (const key of GATEWAY_KEYS) delete process.env[key];
      process.env.OMNIROUTE_BASE_URL = "your-gateway-url";
      try {
        const readiness = getOptionalAiGatewayReadiness();
        assert.equal(readiness.enabled, false);
        assert.equal(readiness.status, "invalid");
      } finally {
        restoreEnv(snapshot);
      }
    });
  });
});
