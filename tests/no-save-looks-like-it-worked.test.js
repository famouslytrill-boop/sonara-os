"use strict";

// Every create endpoint, with every write failing.
//
// The third of the outage crawls. The first two read what a page and an API say
// about records that could not be read; this one asks what a customer is told
// when their record could not be *written*, which is the failure with the
// worst consequence -- they close the tab believing it saved.
//
// The finding is that this half is already sound: every endpoint that reaches a
// write reports the failure, by redirecting back with `?problem=` or by
// answering `ok: false`. Nothing needed fixing. What is worth keeping is the
// check, because the shape it looks for is one line away at any time.
//
// **What it does not cover, stated rather than implied.** 74 endpoints are
// create-shaped; a generic body plus every declared form field gets 40 of them
// as far as a write. The other 34 reject earlier on validation of their own --
// consent requirements, provider contracts, market-intelligence scoring -- and
// modelling each one's valid input is a different piece of work from this. The
// first version of this probe reported "74 of 74 report failure honestly",
// which was true and meaningless: 42 of them were being rejected before the
// write, so the check was measuring the validation path and calling it the
// write path.

const assert = require("node:assert/strict");
const request = require("supertest");

const SUPABASE_ENV = Object.freeze({
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-anon-key-for-write-outage",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-service-role-for-write-outage"
});
const original = Object.fromEntries(Object.keys(SUPABASE_ENV).map((key) => [key, process.env[key]]));

const app = require("../server");
const { CUSTOMER_SESSION_COOKIE } = require("../lib/sonara-customer-auth.cjs");
const { createShapedRoutes } = require("../lib/sonara-form-reachability.cjs");
const { ALL_OWNER_PAGES, childrenOf } = require("../lib/sonara-owner-record-pages.cjs");
const { GROWTH_CREATE_SPECS } = require("../lib/sonara-growth-create-specs.cjs");

const USER = { id: "33333333-3333-4333-8333-333333333333", email: "write-outage@example.com" };
const ORGANIZATION_ID = "44444444-4444-4444-8444-444444444444";
const UUID = "55555555-5555-4555-8555-555555555555";

const json = (body, status = 200) => ({ ok: status < 400, status, headers: { get: () => null }, json: async () => body });
const unreachable = () => ({ ok: false, status: 500, headers: { get: () => null }, json: async () => ({}) });

// A body shaped like the endpoint's own form where one is declared, because a
// hand-written body is how a probe ends up testing the rejection path. Same
// lesson tests/owner-record-lines.test.js learned about `item_name`.
const declaredForms = new Map();
for (const page of ALL_OWNER_PAGES) {
  const action = page.form?.action || page.api;
  if (page.form && action) declaredForms.set(action, page.form.fields || []);
  for (const spec of childrenOf(page)) {
    if (spec.form && spec.api) declaredForms.set(spec.api, [...(spec.form.fields || []), { name: spec.parentColumn, type: "reference" }]);
  }
}
for (const spec of GROWTH_CREATE_SPECS) {
  const fields = (spec.fields || []).map(([name, type, options]) => ({ name, type, options: options && options.options }));
  declaredForms.set(`/api/growth/${spec.key}`, fields);
  declaredForms.set(`/api/growth-studio/${spec.key}`, fields);
}

function valueFor(field) {
  if (field.type === "number") return "100";
  if (field.type === "date") return "2026-08-01";
  if (field.type === "datetime-local") return "2026-08-01T10:00";
  if (field.type === "reference") return UUID;
  if (field.type === "select") return String((field.options || ["active"])[0]);
  if (field.type === "email") return "a@b.co";
  return "X";
}

const GENERIC = {
  name: "X", title: "X", item_name: "X", ingredient_name: "X", description: "X", message: "X",
  amount_cents: "100", quantity: "1", quantity_sold: "1", unit_cost_cents: "100",
  net_sales_cents: "100", line_total_cents: "100", business_date: "2026-08-01",
  effective_from: "2026-08-01", email: "a@b.co", status: "active",
  customer_id: UUID, invoice_id: UUID, recipe_id: UUID, sales_summary_id: UUID,
  employee_id: UUID, purchase_order_id: UUID, session_id: UUID, transfer_id: UUID, vendor_invoice_id: UUID
};

function bodyFor(route) {
  const declared = declaredForms.get(route);
  const body = { ...GENERIC };
  for (const field of declared || []) body[field.name] = valueFor(field);
  return body;
}

describe("no save looks like it worked", () => {
  let realFetch;
  const findings = [];
  const attemptedWrite = new Set();
  let endpoints = 0;

  before(async function crawl() {
    this.timeout(180000);
    Object.assign(process.env, SUPABASE_ENV);
    realFetch = global.fetch;

    let current = null;
    global.fetch = async (url, options = {}) => {
      const target = String(url);
      const method = (options.method || "GET").toUpperCase();
      if (target.includes("/auth/v1/user")) return json(USER);
      if (target.includes("/rest/v1/rpc/")) return json({});
      if (!target.includes("/rest/v1/")) return undefined;

      if (method !== "GET") {
        if (current) attemptedWrite.add(current);
        return unreachable();
      }
      const table = (target.split("/rest/v1/")[1] || "").split("?")[0];
      if (table === "organization_memberships") return json([{ organization_id: ORGANIZATION_ID, user_id: USER.id, role: "owner", status: "active" }]);
      if (table === "business_memberships") return json([{ id: "m", organization_id: ORGANIZATION_ID, workspace_id: "w", role: "owner", status: "active" }]);
      if (table === "organizations") return json([{ id: ORGANIZATION_ID, name: "Outage Ltd" }]);
      if (table === "billing_entitlements") {
        const asked = decodeURIComponent((target.match(/entitlement_key=in\.\(([^)]*)\)/) || ["", ""])[1]).split(",").filter(Boolean);
        return json(asked[0] ? [{ entitlement_key: asked[0], status: "active" }] : []);
      }
      // Parent lookups resolve, so a line endpoint gets as far as its write
      // rather than stopping at "that record is not in your business".
      return json([{ id: UUID, organization_id: ORGANIZATION_ID, name: "X", status: "active" }]);
    };

    const routes = createShapedRoutes(app);
    endpoints = routes.length;
    for (const route of routes) {
      current = route;
      const response = await request(app)
        .post(route)
        .set("Cookie", `${CUSTOMER_SESSION_COOKIE}=stub`)
        .set("Accept", "text/html")
        .type("form")
        .send(bodyFor(route))
        .redirects(0);
      current = null;

      if (!attemptedWrite.has(route)) continue;

      const location = response.headers.location || "";
      let body = {};
      try { body = JSON.parse(response.text || "{}"); } catch { /* an HTML redirect has no body */ }

      // A form submission comes back as a redirect; a failed one must carry a
      // problem. Anything else is the customer being returned to their list as
      // though the record is now on it.
      if (response.status === 303 && !/problem=/.test(location)) {
        findings.push(`${route} redirected to ${location} after the write failed`);
      } else if (response.status >= 200 && response.status < 300 && body.ok !== false) {
        findings.push(`${route} answered ${response.status} ok:${body.ok} after the write failed`);
      }
    }
  });

  after(() => {
    global.fetch = realFetch;
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("reached the write on enough endpoints to be measuring the write", () => {
    assert.ok(endpoints >= 60, `only ${endpoints} create-shaped endpoints found`);
    assert.ok(
      attemptedWrite.size >= 35,
      `only ${attemptedWrite.size} of ${endpoints} endpoints got as far as a write; the bodies no longer satisfy their forms, ` +
        "so this check is measuring validation rather than saving"
    );
  });

  it("tells the customer when their record did not save", () => {
    assert.deepEqual(
      findings,
      [],
      `these endpoints answered as though the record saved:\n  ${findings.join("\n  ")}\n\n` +
        "A failed write must redirect with ?problem= or answer ok: false. Returning somebody to their list is telling them it is on it."
    );
  });
});
