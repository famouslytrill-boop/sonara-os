"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
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
    requireWorkspaceAccess: () => authorize,
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

  it("replaces visible technical readiness with a short business-workspace step", async () => {
    const result = await request(buildApp()).get("/account/setup").set("Accept", "text/html");
    assert.equal(result.status, 200);
    assert.match(result.text, /Name your business workspace/);
    assert.match(result.text, /Continue to Business Builder/);
    assert.match(result.text, /action="\/account\/setup\/organization"/);
    assert.match(result.text, /Offers, customers, orders, and bookings/);
    const visibleText = result.text.replace(/<[^>]+hidden[^>]*>[\s\S]*?<\/[^>]+>/gi, "");
    assert.doesNotMatch(visibleText, /Readiness JSON|Database readiness|organization_memberships|service-role|required tables/i);
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

  it("creates a real service-catalog offer through the allowlisted business API", async () => {
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
      .post(`/api/business-builder/businesses/${BUSINESS_ID}/services`)
      .set("Accept", "application/json")
      .send({ name: "Private chef dinner", category: "offer", price_cents: 32500, description: "Menu planning, shopping, cooking, and cleanup", status: "active" });

    assert.equal(result.status, 201);
    assert.equal(result.body.ok, true);
    const save = calls.find((call) => call.url.includes("business_service_catalog") && call.method === "POST");
    assert.ok(save);
    assert.equal(save.body.business_id, BUSINESS_ID);
    assert.equal(save.body.name, "Private chef dinner");
    assert.equal(save.body.price_cents, 32500);
  });

  it("creates a real customer through the allowlisted business API", async () => {
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
      .post(`/api/business-builder/businesses/${BUSINESS_ID}/customers`)
      .set("Accept", "application/json")
      .send({ name: "Jordan Customer", email: "jordan@example.com", phone: "614-555-0100", status: "lead", notes: "Weekly meal prep" });

    assert.equal(result.status, 201);
    assert.equal(result.body.ok, true);
    const save = calls.find((call) => call.url.includes("customer_records") && call.method === "POST");
    assert.ok(save);
    assert.equal(save.body.business_id, BUSINESS_ID);
    assert.equal(save.body.name, "Jordan Customer");
    assert.equal(save.body.status, "lead");
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

  it("augments the canonical free Offer Builder save with the real service catalog", () => {
    const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
    assert.match(server, /safeInsertBusinessBuilderOperatingRecord/);
    assert.match(server, /business_service_catalog/);
    assert.match(server, /operatingRecordSaved/);
  });
});
