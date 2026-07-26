"use strict";

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const registerRoutes = require("../routes/sonara-business-control-plane-routes.cjs");

const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const BUSINESS_ID = "33333333-3333-4333-8333-333333333333";

function businessRecord(overrides = {}) {
  return {
    id: BUSINESS_ID,
    organization_id: ORGANIZATION_ID,
    owner_user_id: USER_ID,
    name: "Damian's Kitchen",
    public_name: "Damian's Kitchen",
    business_type: "restaurant",
    acquisition_mode: "created",
    industry: "Food service",
    description: "Prepared meals and catering.",
    timezone: "America/New_York",
    currency_code: "usd",
    status: "active",
    version: 1,
    ...overrides
  };
}

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return body; }
  };
}

function buildApp({ paid = true } = {}) {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());

  const authorize = (req, res, next) => {
    if (!paid) return res.status(402).json({ ok: false, code: "upgrade_required" });
    req.sonaraUser = { id: USER_ID, email: "owner@example.com" };
    req.sonaraAccess = { ownerOverride: true, roles: ["owner"] };
    return next();
  };

  registerRoutes(app, {
    layout: ({ title, eyebrow, heading, body, sections = [], actions = [] }) => `<!doctype html><html><title>${title}</title><body><span>${eyebrow || ""}</span><h1>${heading}</h1><p>${body}</p><main>${sections.join("")}</main>${actions.join("")}</body></html>`,
    brandCard: (title, body) => `<article><h2>${title}</h2><p>${body}</p></article>`,
    linkAction: (href, label) => `<a href="${href}">${label}</a>`,
    escapeHtml: (value) => String(value).replace(/[&<>"']/g, ""),
    requireCustomer: authorize,
    requirePaidOrOwnerAccess: () => authorize,
    getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId: ORGANIZATION_ID }),
    getSupabaseServerConfig: () => ({ ok: true, url: "https://example.supabase.co", serviceRoleKey: "server-only" }),
    supabaseHeaders: () => ({ "Content-Type": "application/json" })
  });

  return app;
}

describe("Business Builder operating system", () => {
  let originalFetch;

  beforeEach(() => { originalFetch = global.fetch; });
  afterEach(() => {
    global.fetch = originalFetch;
    delete globalThis.__sonaraBusinessControlRest;
  });

  it("replaces technical account readiness with business onboarding", async () => {
    global.fetch = async (url) => {
      assert.match(String(url), /business_workspaces/);
      return response(200, []);
    };

    const result = await request(buildApp()).get("/account/setup").set("Accept", "text/html");
    assert.equal(result.status, 200);
    assert.match(result.text, /What business are you building\?/);
    assert.match(result.text, /Create business/);
    assert.match(result.text, /Offers, customers, sales, bookings, team, inventory/);
    assert.doesNotMatch(result.text, /Readiness JSON|Database readiness|organization_memberships|service-role|required tables/i);
  });

  it("shows real business records and an evidence-based next action", async () => {
    global.fetch = async (url) => {
      const value = String(url);
      if (value.includes("business_workspaces")) return response(200, [businessRecord()]);
      if (value.includes("business_service_catalog")) return response(200, [{ id: "44444444-4444-4444-8444-444444444444", name: "Catering package", price_cents: 25000, currency: "usd", status: "active" }]);
      if (value.includes("customer_records")) return response(200, [{ id: "55555555-5555-4555-8555-555555555555", name: "First customer", status: "active" }]);
      if (value.includes("order_records")) return response(200, [{ id: "66666666-6666-4666-8666-666666666666", title: "Catering order", amount_cents: 50000, currency: "usd", status: "pending" }]);
      if (value.includes("business_bookings")) return response(200, [{ id: "77777777-7777-4777-8777-777777777777", customer_name: "Event client", starts_at: "2026-08-01T17:00:00.000Z", status: "confirmed" }]);
      if (value.includes("business_employee_profiles")) return response(200, [{ id: "88888888-8888-4888-8888-888888888888", display_name: "Kitchen lead", status: "active" }]);
      if (value.includes("inventory_items")) return response(200, [{ id: "99999999-9999-4999-8999-999999999999", name: "Chicken", quantity: 2, reorder_level: 5, unit: "case", status: "active" }]);
      if (value.includes("business_locations")) return response(200, [{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Main kitchen", status: "active" }]);
      return response(200, []);
    };

    const result = await request(buildApp()).get("/business-builder/dashboard").set("Accept", "text/html");
    assert.equal(result.status, 200);
    assert.match(result.text, /Run the business from one workspace/);
    assert.match(result.text, /Customers/);
    assert.match(result.text, /Open orders/);
    assert.match(result.text, /Upcoming bookings/);
    assert.match(result.text, /Low-stock items/);
    assert.match(result.text, /Review upcoming work/);
    assert.match(result.text, /Offers &amp; services|Offers & services/);
    assert.match(result.text, /Orders &amp; sales|Orders & sales/);
    assert.match(result.text, /Bookings &amp; appointments|Bookings & appointments/);
  });

  it("saves the offer builder into the real service catalog", async () => {
    const calls = [];
    global.fetch = async (url, options = {}) => {
      const call = { url: String(url), method: options.method || "GET", body: options.body ? JSON.parse(options.body) : undefined };
      calls.push(call);
      if (call.url.includes("business_workspaces") && call.method === "GET") return response(200, [businessRecord()]);
      if (call.url.includes("business_service_catalog") && call.method === "POST") return response(201, [{ id: "44444444-4444-4444-8444-444444444444", ...call.body }]);
      if (call.url.includes("business_control_audit_events")) return response(201, []);
      return response(200, []);
    };

    const result = await request(buildApp())
      .post("/api/business-builder/offers")
      .set("Accept", "application/json")
      .send({ serviceType: "Private chef dinner", audience: "Busy families", priceIdea: "$325", deliverables: "Menu planning, shopping, cooking, and cleanup" });

    assert.equal(result.status, 201);
    assert.equal(result.body.ok, true);
    const save = calls.find((call) => call.url.includes("business_service_catalog") && call.method === "POST");
    assert.ok(save);
    assert.equal(save.body.business_id, BUSINESS_ID);
    assert.equal(save.body.name, "Private chef dinner");
    assert.equal(save.body.price_cents, 32500);
    assert.equal(save.body.description, "Menu planning, shopping, cooking, and cleanup");
  });

  it("saves intake into the real customer system", async () => {
    const calls = [];
    global.fetch = async (url, options = {}) => {
      const call = { url: String(url), method: options.method || "GET", body: options.body ? JSON.parse(options.body) : undefined };
      calls.push(call);
      if (call.url.includes("business_workspaces") && call.method === "GET") return response(200, [businessRecord()]);
      if (call.url.includes("customer_records") && call.method === "POST") return response(201, [{ id: "55555555-5555-4555-8555-555555555555", ...call.body }]);
      if (call.url.includes("business_control_audit_events")) return response(201, []);
      return response(200, []);
    };

    const result = await request(buildApp())
      .post("/api/business-builder/intake")
      .set("Accept", "application/json")
      .send({ name: "Jordan Customer", email: "jordan@example.com", phone: "614-555-0100", serviceInterest: "Weekly meal prep", message: "Needs meals for a family of four" });

    assert.equal(result.status, 201);
    assert.equal(result.body.ok, true);
    const save = calls.find((call) => call.url.includes("customer_records") && call.method === "POST");
    assert.ok(save);
    assert.equal(save.body.business_id, BUSINESS_ID);
    assert.equal(save.body.name, "Jordan Customer");
    assert.equal(save.body.status, "lead");
    assert.equal(save.body.metadata.service_interest, "Weekly meal prep");
  });

  it("renders focused operating pages instead of one giant control-plane form", async () => {
    global.fetch = async (url) => {
      const value = String(url);
      if (value.includes("business_workspaces")) return response(200, [businessRecord()]);
      if (value.includes("customer_records")) return response(200, []);
      return response(200, []);
    };

    const result = await request(buildApp()).get(`/business-builder/businesses/${BUSINESS_ID}/manage/customers`).set("Accept", "text/html");
    assert.equal(result.status, 200);
    assert.match(result.text, /<h1>Customers<\/h1>/);
    assert.match(result.text, /Add customers/);
    assert.match(result.text, /Customer name/);
    assert.match(result.text, /No customers yet/);
    assert.doesNotMatch(result.text, /Business JSON|complete JSON list|table checklist|database readiness/i);
  });
});
