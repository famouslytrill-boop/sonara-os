"use strict";

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const register = require("../routes/sonara-last9-routes.cjs");
const { estimateCatering } = require("../lib/sonara-catering-estimator.cjs");
const { draftQuoteHandoff, POSTGRES_INT_MAX } = require("../lib/sonara-catering-quote-handoff.cjs");

const ORG = "11111111-1111-4111-8111-111111111111";
const OTHER = "99999999-9999-4999-8999-999999999999";
const USER = "22222222-2222-4222-8222-222222222222";
const CUSTOMER = "33333333-3333-4333-8333-333333333333";
const json = (rows, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => rows });

function appFor() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  register(app, {
    layout: ({ title, sections = [], actions = [] }) => "<html><title>" + title +
      "</title>" + sections.join("") + actions.join("") + "</html>",
    brandCard: (heading, body) => "<article><h2>" + heading + "</h2>" + body + "</article>",
    linkAction: (href, label) => '<a href="' + href + '">' + label + "</a>",
    escapeHtml: String,
    requireCustomer: (req, res, next) => next(),
    requireBusinessManager: (req, res, next) => { req.sonaraUser = { id: USER }; next(); },
    getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId: ORG, role: "owner" }),
    getSupabaseServerConfig: () => ({
      ok: true, url: "https://example.supabase.co", serviceRoleKey: "fake-server-test-key"
    }),
    createRateLimiter: () => (req, res, next) => next()
  });
  return app;
}

describe("a catering quote cannot pretend to be accepted", () => {
  let previousFetch;
  let calls;
  beforeEach(() => {
    calls = [];
    previousFetch = global.fetch;
    global.fetch = async (url, options = {}) => {
      const target = String(url), method = options.method || "GET";
      calls.push({ target, method, payload: options.body ? JSON.parse(options.body) : null });
      if (target.includes("/rest/v1/customers?")) {
        return json(target.includes("id=eq." + CUSTOMER) && target.includes("organization_id=eq." + ORG)
          ? [{ id: CUSTOMER }] : []);
      }
      if (target.includes("/rest/v1/quotes") && method === "POST") {
        return json([{ id: "44444444-4444-4444-8444-444444444444" }], 201);
      }
      return json([]);
    };
  });
  afterEach(() => { global.fetch = previousFetch; });

  it("forces client-supplied accepted/sent/invoiced claims to remain a draft", async () => {
    const result = await request(appFor()).post("/api/business/quotes")
      .set("Accept", "application/json").send({
        title: "Catering dinner", amount_cents: "45000",
        status: "accepted", accepted_at: "2026-10-01T10:00:00Z",
        invoice_id: "55555555-5555-4555-8555-555555555555",
        organization_id: OTHER, created_by: OTHER,
        customer_id: CUSTOMER
      });
    assert.equal(result.status, 200);
    const row = calls.find((call) => call.target.endsWith("/rest/v1/quotes") && call.method === "POST")?.payload;
    assert.ok(row, "quote was not inserted");
    assert.equal(row.status, "draft");
    assert.equal(row.organization_id, ORG);
    assert.equal(row.created_by, USER);
    assert.equal(row.customer_id, CUSTOMER);
    assert.equal(row.amount_cents, "45000");
    assert.equal(row.accepted_at, undefined);
    assert.equal(row.invoice_id, undefined);
  });

  it("rejects foreign customer references rather than linking to another tenant", async () => {
    const result = await request(appFor()).post("/api/business/quotes")
      .send({ title: "Foreign contact", customer_id: OTHER, amount_cents: "20000" });
    assert.equal(result.status, 403);
    assert.equal(result.body.code, "customer_id_not_yours");
    assert.ok(!calls.some((c) => c.target.endsWith("/rest/v1/quotes") && c.method === "POST"));
  });

  it("rejects nonnumeric or out-of-range amounts before database writes", async () => {
    for (const amount of ["-1", "1.2", "not money", String(POSTGRES_INT_MAX + 1)]) {
      calls = [];
      const result = await request(appFor()).post("/api/business/quotes")
        .send({ title: "Improper quote", amount_cents: amount });
      assert.equal(result.status, 400, amount);
      assert.equal(result.body.code, "quote_amount_invalid");
      assert.ok(!calls.some((c) => c.target.endsWith("/rest/v1/quotes") && c.method === "POST"));
    }
  });

  it("provides a valid explicit action for a verified estimate without simulating a payment", () => {
    const estimate = estimateCatering({
      currency: "USD", guests: 10, capacityGuests: 20,
      menuItems: [{ name: "Dinner", portionsPerGuest: 1, pricePerPortionCents: 2500,
        foodCostPerPortionCents: 700, availablePortions: 20 }],
      staffingCostCents: 5000, equipmentCostCents: 0, travelCostCents: 0,
      venueCostCents: 0, additionalCostCents: 0, serviceChargeCents: 0,
      taxAmountCents: 0, depositBasisPoints: 0
    });
    const handoff = draftQuoteHandoff(estimate, "Private Chef Event");
    assert.equal(handoff.ok, true);
    assert.equal(handoff.destination, "/api/business/quotes");
    assert.equal(handoff.fields.amount_cents, "25000");
    assert.equal(handoff.fields.status, "draft");
    assert.equal(handoff.fields.customer_id, undefined);
    assert.equal(handoff.moneyCollected, false);
    assert.equal(handoff.bookingCreated, false);
  });

  it("does not offer a save for sums beyond the existing Postgres integer column", () => {
    const draft = {
      ok: true, status: "draft_owner_review_required", currency: "USD",
      charged: false, saved: false, paymentCollected: false, venueBooked: false,
      menu: [{ name: "Event" }],
      totals: { customerEstimateCents: POSTGRES_INT_MAX + 1 }
    };
    assert.equal(draftQuoteHandoff(draft, "Event").code, "quote_exceeds_existing_database_amount_limit");
  });
});
