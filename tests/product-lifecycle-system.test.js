"use strict";

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const registerRoutes = require("../routes/product-lifecycle-routes.cjs");

const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const INITIATIVE_ID = "33333333-3333-4333-8333-333333333333";

function buildApp() {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  const authorize = (req, res, next) => { req.sonaraUser = { id: USER_ID, email: "owner@example.com" }; next(); };
  registerRoutes(app, {
    layout: ({ title, heading, body, sections = [], actions = [] }) => `<html><title>${title}</title><h1>${heading}</h1><p>${body}</p><nav>${actions.join("")}</nav>${sections.join("")}</html>`,
    brandCard: (title, body) => `<article><h2>${title}</h2><p>${body}</p></article>`,
    linkAction: (href, label) => `<a href="${href}">${label}</a>`,
    escapeHtml: (value) => String(value).replace(/[&<>"']/g, ""),
    requireCustomer: authorize,
    requireWorkspaceAccess: () => authorize,
    getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId: ORGANIZATION_ID }),
    getSupabaseServerConfig: () => ({ ok: true, url: "https://project.supabase.co", serviceRoleKey: "server-only" })
  });
  return app;
}

function jsonResponse(status, value) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

describe("SONARA Product Lifecycle", () => {
  let originalFetch;

  beforeEach(() => { originalFetch = global.fetch; });
  afterEach(() => { global.fetch = originalFetch; });

  it("publishes a seven-stage framework with evidence and safety controls", async () => {
    const result = await request(buildApp()).get("/api/product-lifecycle/framework");
    assert.equal(result.status, 200);
    assert.equal(result.body.stages.length, 7);
    assert.deepEqual(result.body.controls.observabilitySignals, ["traces", "metrics", "logs"]);
    assert.equal(result.body.controls.accessibilityTarget, "WCAG_2_2_AA");
    assert.equal(result.body.controls.directBrowserDatabaseWrites, false);
  });

  it("creates an organization-scoped initiative and records an audit event", async () => {
    const calls = [];
    global.fetch = async (url, options = {}) => {
      const body = options.body ? JSON.parse(options.body) : null;
      calls.push({ url: String(url), method: options.method || "GET", body });
      if (String(url).includes("/rest/v1/product_lifecycle_initiatives") && options.method === "POST") {
        return jsonResponse(201, [{ id: INITIATIVE_ID, ...body }]);
      }
      if (String(url).includes("/rest/v1/product_lifecycle_events")) return jsonResponse(201, []);
      return jsonResponse(200, []);
    };

    const result = await request(buildApp()).post("/api/product-lifecycle/initiatives").send({
      studio_key: "business_builder",
      name: "Neighborhood catering MVP",
      problem_statement: "Independent caterers lose leads during manual follow-up.",
      target_audience: "Independent caterers with fewer than 10 employees"
    });

    assert.equal(result.status, 201);
    assert.equal(result.body.initiative.organization_id, ORGANIZATION_ID);
    assert.equal(result.body.initiative.studio_key, "business_builder");
    assert.equal(calls.find((call) => call.url.includes("product_lifecycle_events")).body.event_type, "initiative.created");
  });

  it("blocks unsupported studios and incomplete advance decisions", async () => {
    const invalid = await request(buildApp()).post("/api/product-lifecycle/initiatives").send({ studio_key: "unknown", name: "Invalid" });
    assert.equal(invalid.status, 400);

    const initiative = {
      id: INITIATIVE_ID,
      organization_id: ORGANIZATION_ID,
      studio_key: "creator_studio",
      name: "Release workflow",
      lifecycle_stage: "discover",
      status: "active",
      problem_statement: null,
      target_audience: null,
      value_proposition: null,
      product_goal: null,
      primary_metric: null,
      target_metric: null
    };

    global.fetch = async (url, options = {}) => {
      const stringUrl = String(url);
      if (stringUrl.includes("product_lifecycle_initiatives") && (options.method || "GET") === "GET") return jsonResponse(200, [initiative]);
      return jsonResponse(200, []);
    };

    const review = await request(buildApp()).post(`/api/product-lifecycle/initiatives/${INITIATIVE_ID}/reviews`).send({ decision: "advance", rationale: "Build now", approved: true });
    assert.equal(review.status, 409);
    assert.equal(review.body.code, "stage_gate_not_ready");
    assert.ok(review.body.readiness.score < 70);
  });

  it("records structured evidence, scope, and beta feedback through server-only writes", async () => {
    const initiative = { id: INITIATIVE_ID, organization_id: ORGANIZATION_ID, studio_key: "growth_studio", name: "Consent-safe nurture", lifecycle_stage: "validate", status: "active" };
    const calls = [];
    global.fetch = async (url, options = {}) => {
      const stringUrl = String(url);
      const body = options.body ? JSON.parse(options.body) : null;
      calls.push({ url: stringUrl, method: options.method || "GET", body });
      if (stringUrl.includes("product_lifecycle_initiatives") && (options.method || "GET") === "GET") return jsonResponse(200, [initiative]);
      if ((options.method || "GET") === "POST") return jsonResponse(201, [{ id: "44444444-4444-4444-8444-444444444444", ...body }]);
      return jsonResponse(200, []);
    };

    const evidence = await request(buildApp()).post(`/api/product-lifecycle/initiatives/${INITIATIVE_ID}/evidence`).send({ evidence_type: "interview", source: "Owner interviews", summary: "Five owners confirmed follow-up delay is costly.", participant_count: 5, confidence: "high" });
    const requirement = await request(buildApp()).post(`/api/product-lifecycle/initiatives/${INITIATIVE_ID}/requirements`).send({ requirement_type: "user_story", title: "As an owner, I want approved follow-up tasks", priority: "must" });
    const feedback = await request(buildApp()).post(`/api/product-lifecycle/initiatives/${INITIATIVE_ID}/feedback`).send({ category: "usability", severity: "high", summary: "Consent purpose is hard to find." });

    assert.equal(evidence.status, 201);
    assert.equal(requirement.status, 201);
    assert.equal(feedback.status, 201);
    assert.ok(calls.every((call) => !call.url.includes("anon")));
    assert.equal(calls.find((call) => call.url.includes("product_lifecycle_evidence") && call.method === "POST").body.organization_id, ORGANIZATION_ID);
  });

  it("renders lifecycle entry points for the parent and every studio", async () => {
    global.fetch = async () => jsonResponse(200, []);
    for (const route of ["/product-lifecycle", "/business-builder/product-lifecycle", "/creator-studio/product-lifecycle", "/growth-studio/product-lifecycle"]) {
      const result = await request(buildApp()).get(route);
      assert.equal(result.status, 200, route);
      assert.match(result.text, /evidence-backed products/i);
      // The heading was "Create lifecycle initiative" until 2 September 2026.
      // "lifecycle" is in BANNED_ON_CUSTOMER_PAGES and these are customer
      // pages -- the route registry already calls them Roadmap in navigation,
      // so the card contradicted the link that reached it.
      //
      // The form's action is asserted alongside the new heading, because a
      // heading is copy and will be reworded again; where the form posts is the
      // thing this test is actually protecting.
      assert.match(result.text, /Start something new/i);
      assert.match(result.text, /action="\/product-lifecycle\/initiatives"/);
    }
  });
});
