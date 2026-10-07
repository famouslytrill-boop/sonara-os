"use strict";

// The operations summary read money received from `payments`, a table nothing
// in the product writes, and added cents across currencies. These tests drive
// the page and its JSON twin against the tables money is actually recorded in
// -- payments against invoices and paid shop orders -- and check what a
// business is told.

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const express = require("express");
const request = require("supertest");
const { createFakeSupabase } = require("./helpers/fake-supabase.cjs");
const registerOperationsExpansionRoutes = require("../routes/sonara-operations-expansion-routes.cjs");
const { escapeHtml } = require("../lib/sonara-shell.cjs");

const ORG = "11111111-1111-4111-8111-111111111111";
const OTHER_ORG = "99999999-9999-4999-8999-999999999999";
const PAGE = "/business-builder/owner/operations";
const recent = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString();

function buildApp(fake) {
  const app = express();
  registerOperationsExpansionRoutes(app, {
    requireBusinessManager: (req, res, next) => { req.sonaraUser = { id: "22222222-2222-4222-8222-222222222222" }; next(); },
    getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId: ORG }),
    getSupabaseServerConfig: () => ({ ok: true, url: fake.url, serviceRoleKey: "server-only" }),
    supabaseHeaders: () => ({ apikey: "server-only", Authorization: "Bearer server-only" }),
    layout: ({ title, heading, body, sections = [], actions = [] }) => `<html><title>${title}</title><h1>${heading}</h1><p>${body}</p><nav>${actions.join("")}</nav>${sections.join("")}</html>`,
    linkAction: (href, label) => `<a href="${href}">${label}</a>`,
    escapeHtml
  });
  return app;
}

function seeded(extra = {}) {
  const usdInvoice = crypto.randomUUID();
  const gbpInvoice = crypto.randomUUID();
  const elsewhereInvoice = crypto.randomUUID();
  return {
    customer_invoices: [
      { id: usdInvoice, organization_id: ORG, currency: "usd", total_cents: 20000 },
      { id: gbpInvoice, organization_id: ORG, currency: "gbp", total_cents: 9000 },
      { id: elsewhereInvoice, organization_id: OTHER_ORG, currency: "usd", total_cents: 500000 }
    ],
    customer_invoice_payments: [
      { id: crypto.randomUUID(), organization_id: ORG, invoice_id: usdInvoice, amount_cents: 12500, received_on: recent(3).slice(0, 10) },
      { id: crypto.randomUUID(), organization_id: ORG, invoice_id: gbpInvoice, amount_cents: 3000, received_on: recent(2).slice(0, 10) },
      { id: crypto.randomUUID(), organization_id: OTHER_ORG, invoice_id: elsewhereInvoice, amount_cents: 500000, received_on: recent(2).slice(0, 10) }
    ],
    merchant_orders: [
      { id: crypto.randomUUID(), organization_id: ORG, payment_state: "paid", amount_paid_cents: 4000, refunded_cents: 0, currency: "usd", paid_at: recent(1) },
      { id: crypto.randomUUID(), organization_id: ORG, payment_state: "refunded", amount_paid_cents: 2000, refunded_cents: 500, currency: "gbp", paid_at: recent(1) },
      { id: crypto.randomUUID(), organization_id: ORG, payment_state: "disputed", amount_paid_cents: 7000, refunded_cents: 0, currency: "usd", paid_at: recent(1) }
    ],
    // The table the summary used to read. Nothing writes it in production; a
    // row here is how a test notices if it is read again.
    payments: [{ id: crypto.randomUUID(), organization_id: ORG, status: "paid", amount_cents: 99999900, created_at: recent(1) }],
    business_bookings: [
      { id: crypto.randomUUID(), organization_id: ORG, status: "completed", starts_at: recent(4), ends_at: new Date(Date.parse(recent(4)) + 3600000).toISOString(), created_at: recent(5) }
    ],
    employee_time_entries: [],
    inventory_items: [],
    location_events: [],
    ...extra
  };
}

describe("how the business is doing counts real money", () => {
  let fake;
  let savedFetch;

  function start(tables) {
    fake = createFakeSupabase({ users: {}, tables, ids: "uuid" });
    savedFetch = global.fetch;
    global.fetch = fake.install(savedFetch);
    return buildApp(fake);
  }

  afterEach(() => {
    if (savedFetch) global.fetch = savedFetch;
    savedFetch = null;
  });

  it("shows money received from invoices and the shop, per currency, and never the table nothing writes", async () => {
    const app = start(seeded());
    const shown = await request(app).get(PAGE).set("accept", "text/html");
    assert.equal(shown.status, 200, shown.text.slice(0, 300));
    assert.match(shown.text, /USD 165\.00/, "invoice 125.00 + shop 40.00 in dollars is not shown");
    assert.match(shown.text, /GBP 45\.00/, "invoice 30.00 + shop 20.00 less 5.00 refunded in pounds is not shown");
    assert.doesNotMatch(shown.text, /999999/, "the unwritten payments table was read");
    assert.doesNotMatch(shown.text, /5000\.00|5165\.00/, "another business's payment was counted");
    assert.match(shown.text, /not added together/, "two currencies are shown without saying they are not summed");
    assert.match(shown.text, /1 shop order\(s\) are in dispute/, "a disputed order is not called out");
    assert.ok(fake.queries.some((query) => query.table === "customer_invoice_payments"), "the queries were not recorded, so the next line proves nothing");
    assert.ok(!fake.queries.some((query) => query.table === "payments"), "the summary still asks the payments table");
  });

  it("answers the JSON client from the same reader", async () => {
    const app = start(seeded());
    const answered = await request(app).get("/api/business/operations/analytics?days=30");
    assert.equal(answered.status, 200);
    assert.deepEqual(answered.body.money.byCurrency.map((line) => [line.currency, line.totalCents]), [["gbp", 4500], ["usd", 16500]]);
    assert.equal(answered.body.payments, undefined);
    assert.deepEqual(answered.body.truncatedSources, []);
  });

  it("names a source it could not read and shows no figures in its place", async () => {
    const app = start(seeded());
    const installed = global.fetch;
    global.fetch = async (input, init = {}) => {
      if (String(typeof input === "string" ? input : input?.url).includes("/rest/v1/customer_invoices?")) return { ok: false, status: 500, headers: { get: () => null }, json: async () => ({}) };
      return installed(input, init);
    };
    const shown = await request(app).get(PAGE).set("accept", "text/html");
    assert.equal(shown.status, 503);
    assert.match(shown.text, /the invoices those payments belong to/);
    assert.doesNotMatch(shown.text, /<h2>Money received<\/h2>/, "figures were shown beside a source that could not be read");
    const answered = await request(app).get("/api/business/operations/analytics");
    assert.equal(answered.status, 503);
    assert.deepEqual(answered.body.unreadableSources, ["invoices"]);
  });

  it("says a total is at least the figure when a read came back at its limit", async () => {
    const orders = Array.from({ length: 1000 }, () => ({ id: crypto.randomUUID(), organization_id: ORG, payment_state: "paid", amount_paid_cents: 100, refunded_cents: 0, currency: "usd", paid_at: recent(1) }));
    const app = start(seeded({ merchant_orders: orders }));
    const shown = await request(app).get(PAGE).set("accept", "text/html");
    assert.match(shown.text, /at least the figure shown/, "a capped read was presented as the full figure");
    const answered = await request(app).get("/api/business/operations/analytics");
    assert.deepEqual(answered.body.truncatedSources, ["shopOrders"]);
  });
});
