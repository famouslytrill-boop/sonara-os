"use strict";

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const { estimateCatering } = require("../lib/sonara-catering-estimator.cjs");
const register = require("../routes/sonara-catering-routes.cjs");

const USER = "22222222-2222-4222-8222-222222222222";
const ORG = "11111111-1111-4111-8111-111111111111";

function draft(override = {}) {
  return {
    currency: "USD", guests: 10, capacityGuests: 30,
    menuItems: [{
      name: "Catering plate", portionsPerGuest: 2,
      pricePerPortionCents: 2500, foodCostPerPortionCents: 700,
      availablePortions: 25
    }],
    staffingCostCents: 12000, equipmentCostCents: 3000,
    travelCostCents: 5000, venueCostCents: 8000,
    additionalCostCents: 2000, serviceChargeCents: 1000,
    taxAmountCents: 4000, depositBasisPoints: 2500,
    ...override
  };
}

function appFor({ authorized = true, organization = ORG } = {}) {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  register(app, {
    requireBusinessManager: (req, res, next) => {
      if (!authorized) return res.status(403).json({ ok: false, code: "business_manager_required" });
      req.sonaraUser = { id: USER };
      next();
    },
    getCustomerPrimaryOrganization: async () =>
      organization ? { ok: true, organizationId: organization } : { ok: false },
    layout: ({ title, heading, sections }) =>
      "<!doctype html><html><head><title>" + title + "</title></head><body><h1>" +
      heading + "</h1>" + sections.join("") + "</body></html>",
    escapeHtml: (v) => String(v).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch])),
    linkAction: (url, label) => '<a href="' + url + '">' + label + "</a>"
  });
  return app;
}

describe("catering estimator and authenticated owner page", () => {
  it("calculates integer-cent revenue, food/labor/logistics costs and deposit without charging", () => {
    const r = estimateCatering(draft());
    assert.equal(r.ok, true);
    assert.equal(r.totals.menuSubtotalCents, 50000);
    assert.equal(r.totals.foodCostCents, 14000);
    assert.equal(r.totals.plannedOperatingCostCents, 44000);
    assert.equal(r.totals.customerEstimateCents, 55000);
    assert.equal(r.totals.suggestedDepositCents, 13750);
    assert.equal(r.totals.amountAfterDepositCents, 41250);
    assert.equal(r.totals.contributionBeforeServiceChargeAndTaxCents, 6000);
    assert.equal(r.totals.contributionMarginBasisPoints, 1200);
    assert.equal(r.menu[0].shortage, 0);
    assert.equal(r.paymentCollected, false);
    assert.equal(r.venueBooked, false);
    assert.equal(r.customerQuoteSent, false);
  });

  it("counts portions, flags shortages and does not mistake unknown stock for zero", () => {
    const short = estimateCatering(draft({ menuItems: [
      { name: "Pasta", portionsPerGuest: 3, pricePerPortionCents: 1200,
        foodCostPerPortionCents: 500, availablePortions: 18 }
    ] }));
    assert.equal(short.menu[0].shortage, 12);
    assert.ok(short.issues.includes("inventory_shortage:Pasta"));
    const unknown = estimateCatering(draft({ menuItems: [
      { name: "Pasta", portionsPerGuest: 1, pricePerPortionCents: 1200,
        foodCostPerPortionCents: 500 }
    ] }));
    assert.equal(unknown.menu[0].shortage, null);
    assert.ok(unknown.issues.includes("inventory_unverified:Pasta"));
    assert.ok(!unknown.issues.includes("inventory_shortage:Pasta"));
  });

  it("treats missing venue capacity and zero capacity differently", () => {
    assert.ok(estimateCatering(draft({ capacityGuests: null })).issues.includes("venue_capacity_unverified"));
    assert.ok(estimateCatering(draft({ capacityGuests: 0 })).issues.includes("venue_capacity_shortage"));
  });

  it("rejects malformed, fractional, excessive and unknown monetary values", () => {
    for (const change of [
      { guests: 0 }, { guests: 2.5 }, { guests: 20001 },
      { currency: "JPY" }, { taxAmountCents: undefined },
      { taxAmountCents: -1 }, { depositBasisPoints: 10001 },
      { menuItems: [] },
      { menuItems: [{ name: "A", portionsPerGuest: 1, pricePerPortionCents: 1.1,
        foodCostPerPortionCents: 0 }] },
      { menuItems: [{ name: "A", portionsPerGuest: 1, pricePerPortionCents: 1e12,
        foodCostPerPortionCents: 0 }] }
    ]) {
      const r = estimateCatering(draft(change));
      assert.equal(r.ok, false, JSON.stringify(change));
      assert.equal(r.charged, false);
      assert.equal(r.saved, false);
      assert.equal(r.totals, undefined);
    }
  });

  it("rejects a subtotal larger than the safe financial envelope", () => {
    const r = estimateCatering(draft({ guests: 20000, menuItems: [{
      name: "Oversized", portionsPerGuest: 20, pricePerPortionCents: 1e10,
      foodCostPerPortionCents: 1, availablePortions: null
    }] }));
    assert.equal(r.ok, false);
    assert.ok(r.issues.includes("estimate_exceeds_safe_money_limit"));
  });

  it("renders a real owner calculator and turns form dollars into integer cents", async () => {
    const app = appFor();
    const page = await request(app).get("/business-builder/owner/catering");
    assert.equal(page.status, 200);
    assert.match(page.text, /Calculate catering estimate/);
    const form = await request(app).post("/business-builder/owner/catering/estimate").type("form").send({
      guests: "10", capacity: "12", menu_name: "Catering plate", portions: "2",
      selling_price: "25.00", food_cost: "7.00", available: "20",
      staff_cost: "120.00", equipment_cost: "30.00", travel_cost: "50.00",
      venue_cost: "80.00", additional_cost: "20.00",
      service_charge: "10.00", tax_amount: "40.00", deposit_percent: "25.00"
    });
    assert.equal(form.status, 200);
    assert.match(form.text, /\$550\.00/);
    assert.match(form.text, /Nothing was saved, charged, sent, or reserved/);
  });

  it("offers a real but separate owner-click draft quote save after calculating", async () => {
    const result = await request(appFor()).post("/business-builder/owner/catering/estimate")
      .type("form").send({
        guests: "10", capacity: "15", menu_name: "Weekend food &amp; service",
        portions: "1", selling_price: "25.00", food_cost: "7.00",
        available: "10", staff_cost: "20.00", equipment_cost: "0",
        travel_cost: "0", venue_cost: "0", additional_cost: "0",
        service_charge: "0", tax_amount: "0", deposit_percent: "0"
      });
    assert.equal(result.status, 200);
    assert.match(result.text, /action="\/api\/business\/quotes"/);
    assert.match(result.text, /name="amount_cents" value="25000"/);
    assert.match(result.text, /name="status" value="draft"/);
    assert.match(result.text, /Save draft quote summary/);
    assert.match(result.text, /does not save menu lines/);
    assert.doesNotMatch(result.text, /name="organization_id"/);
  });

  it("never offers saving an invalid catering amount as a quote", async () => {
    const result = await request(appFor()).post("/business-builder/owner/catering/estimate")
      .type("form").send({
        guests: "0", menu_name: "Empty event", portions: "1",
        selling_price: "25.00", food_cost: "7.00",
        staff_cost: "0", equipment_cost: "0", travel_cost: "0",
        venue_cost: "0", additional_cost: "0", service_charge: "0",
        tax_amount: "0", deposit_percent: "0"
      });
    assert.equal(result.status, 422);
    assert.doesNotMatch(result.text, /action="\/api\/business\/quotes"/);
  });

  it("API uses the same formula and never stores a customer or card", async () => {
    const r = await request(appFor()).post("/api/business/catering/estimate").send(draft());
    assert.equal(r.status, 200);
    assert.equal(r.body.totals.customerEstimateCents, 55000);
    assert.equal(r.headers["cache-control"], "private, no-store");
  });

  it("does not allow unauthorized or org-less users to see or compute an estimate", async () => {
    const denied = await request(appFor({ authorized: false })).post("/api/business/catering/estimate").send(draft());
    assert.equal(denied.status, 403);
    const noOrg = await request(appFor({ organization: null })).get("/business-builder/owner/catering");
    assert.equal(noOrg.status, 403);
  });
});
