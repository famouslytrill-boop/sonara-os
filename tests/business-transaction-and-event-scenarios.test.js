"use strict";

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const {
  simulateMicrotransaction, reviewNonprofitContribution
} = require("../lib/sonara-business-transaction-review.cjs");
const { assessEventResourceScenario, instant } = require("../lib/sonara-event-resource-scenario.cjs");
const register = require("../routes/sonara-catering-routes.cjs");
const registerFinancePages = require("../routes/sonara-financial-scenario-pages.cjs");

const USER = "22222222-2222-4222-8222-222222222222";
const ORG = "11111111-1111-4111-8111-111111111111";

const merchant = (updates = {}) => ({
  currency: "USD", priceCents: 100, quantity: 100,
  providerMinimumCents: 50, processorFixedFeeCents: 30,
  processorRateBasisPoints: 290, deliveryCostPerUnitCents: 10,
  riskReservePerUnitCents: 5, ...updates
});
const nonprofit = (updates = {}) => ({
  currency: "USD", amountCents: 10000, estimatedBenefitValueCents: 4000,
  restrictedPurpose: false, ...updates
});
const reservation = (id, from, to, units = 2, state = "confirmed") => ({
  id, resourceId: "chafing", units, startsAt: from, endsAt: to, state
});
const scenario = (updates = {}) => ({
  startsAt: "2026-12-01T10:00:00-05:00",
  endsAt: "2026-12-01T13:00:00-05:00",
  timeZone: "America/New_York",
  guests: 40, venueCapacityGuests: 50,
  resources: [{ id: "chafing", capacity: 5 }],
  requirements: [{ resourceId: "chafing", units: 3 }],
  resourceSnapshotComplete: true, reservationSnapshotComplete: true,
  reservations: [
    reservation("first", "2026-12-01T10:00:00-05:00", "2026-12-01T11:00:00-05:00"),
    reservation("second", "2026-12-01T11:00:00-05:00", "2026-12-01T12:00:00-05:00", 2, "held")
  ],
  ...updates
});

function appFor({ allowed = true, organizationId = ORG } = {}) {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  const deps = {
    requireBusinessManager: (req, res, next) => {
      if (!allowed) return res.status(403).json({ ok: false, code: "manager_required" });
      req.sonaraUser = { id: USER };
      next();
    },
    getCustomerPrimaryOrganization: async () =>
      organizationId ? { ok: true, organizationId } : { ok: false },
    layout: ({ title, sections = [] }) => "<title>" + title + "</title>" + sections.join(""),
    escapeHtml: (v) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;"),
    linkAction: (href, label) => '<a href="' + href + '">' + label + "</a>"
  };
  register(app, deps);
  registerFinancePages(app, deps);
  return app;
}

describe("Business Builder transaction preview safety", () => {
  it("calculates processor fee per transaction, with conservative rounding", () => {
    const result = simulateMicrotransaction(merchant());
    assert.equal(result.ok, true);
    assert.equal(result.processorFeePerUnitCents, 33);
    assert.equal(result.contributionPerUnitCents, 52);
    assert.equal(result.aggregateContributionCents, 5200);
    assert.equal(result.grossScenarioCents, 10000);
    assert.equal(result.paymentAuthorized, false);
    assert.equal(result.providerTermsVerified, false);
  });
  it("marks amounts below the owner-entered provider minimum", () => {
    const result = simulateMicrotransaction(merchant({ priceCents: 49 }));
    assert.equal(result.minimumMetUnderAssumptions, false);
    assert.ok(result.reviewIssues.includes("below_assumed_provider_minimum"));
    assert.equal(result.paymentCollected, false);
  });
  it("refuses absent fees, negative rates, fractions and unsafe volume totals", () => {
    const variants = [
      { processorFixedFeeCents: undefined },
      { processorRateBasisPoints: -1 },
      { processorFixedFeeCents: 0.5 },
      { quantity: 0 },
      { quantity: 1000001 },
      { priceCents: 1000000000000, quantity: 1000000 }
    ];
    for (const changes of variants) {
      assert.equal(simulateMicrotransaction(merchant(changes)).ok, false, JSON.stringify(changes));
    }
  });
  it("identifies nonpositive margins without claiming a payout", () => {
    const result = simulateMicrotransaction(merchant({ priceCents: 50, deliveryCostPerUnitCents: 30 }));
    assert.equal(result.profitableUnderAssumptions, false);
    assert.ok(result.reviewIssues.includes("non_positive_contribution"));
    assert.equal(result.settledFundsVerified, false);
  });
  it("keeps written acknowledgment >=$250 distinct from disclosure >$75", () => {
    const under = reviewNonprofitContribution(nonprofit({ amountCents: 7500 }));
    const over = reviewNonprofitContribution(nonprofit({ amountCents: 7501 }));
    const acknowledgment = reviewNonprofitContribution(nonprofit({
      amountCents: 25000, estimatedBenefitValueCents: 0
    }));
    assert.equal(under.thresholds.organizationQuidProQuoDisclosureForOver75USD, false);
    assert.equal(over.thresholds.organizationQuidProQuoDisclosureForOver75USD, true);
    assert.equal(acknowledgment.thresholds.donorAcknowledgmentForAtLeast250USD, true);
    assert.equal(acknowledgment.thresholds.organizationQuidProQuoDisclosureForOver75USD, false);
    assert.equal(acknowledgment.taxDeductibleAmountDetermined, false);
    assert.equal(acknowledgment.receiptIssued, false);
  });
  it("never calls a sales exchange an automatically deductible contribution", () => {
    const result = reviewNonprofitContribution(nonprofit({ restrictedPurpose: true }));
    assert.equal(result.state, "draft_compliance_flags_only");
    assert.ok(result.reviewIssues.includes("restricted_fund_allocation_requires_review"));
    assert.equal(result.charitableStatusVerified, false);
    assert.equal(result.disclosureIssued, false);
    assert.equal(reviewNonprofitContribution(nonprofit({
      estimatedBenefitValueCents: 10001
    })).ok, false);
  });
});

describe("event and catering capacity preview", () => {
  it("counts peak concurrent reservations, not cumulative bookings", () => {
    const result = assessEventResourceScenario(scenario());
    assert.equal(result.ok, true);
    assert.equal(result.resourceChecks[0].peakReservedUnitsInSnapshot, 2);
    assert.equal(result.resourceChecks[0].shortageUnits, 0);
    assert.equal(result.scenarioFitsRecordedCapacity, true);
    assert.equal(result.bookable, false);
    assert.equal(result.reservationCreated, false);
  });
  it("recognizes overlapping held reservations and a genuine shortage", () => {
    const result = assessEventResourceScenario(scenario({
      reservations: [...scenario().reservations,
        reservation("third", "2026-12-01T10:30:00-05:00", "2026-12-01T11:30:00-05:00", 1)]
    }));
    assert.equal(result.resourceChecks[0].peakReservedUnitsInSnapshot, 3);
    assert.equal(result.resourceChecks[0].shortageUnits, 1);
    assert.equal(result.scenarioFitsRecordedCapacity, false);
  });
  it("does not include cancelled bookings in concurrent capacity", () => {
    const result = assessEventResourceScenario(scenario({
      reservations: [...scenario().reservations,
        reservation("cancelled", "2026-12-01T10:00:00-05:00",
          "2026-12-01T13:00:00-05:00", 5, "cancelled")]
    }));
    assert.equal(result.resourceChecks[0].peakReservedUnitsInSnapshot, 2);
  });
  it("unknown capacity is not free capacity", () => {
    const result = assessEventResourceScenario(scenario({
      resources: [{ id: "chafing", capacity: null }],
      venueCapacityGuests: null,
      resourceSnapshotComplete: false
    }));
    assert.equal(result.resourceChecks[0].state, "unknown");
    assert.ok(result.warnings.includes("venue_capacity_unverified"));
    assert.ok(result.warnings.includes("snapshot_completeness_unverified"));
    assert.equal(result.scenarioFitsRecordedCapacity, false);
  });
  it("rejects timezone-naive, impossible and inverted event times", () => {
    assert.equal(instant("2026-02-30T10:00:00Z"), null);
    assert.equal(instant("2026-11-01T01:30:00"), null);
    for (const changes of [
      { startsAt: "2026-02-30T10:00:00Z" },
      { startsAt: "2026-11-01T01:30:00" },
      { endsAt: "2026-12-01T09:00:00-05:00" },
      { timeZone: "Nowhere/Unknown" }
    ]) {
      assert.equal(assessEventResourceScenario(scenario(changes)).ok, false);
    }
  });
  it("rejects duplicates, inconsistent resource references and unknown booking status", () => {
    for (const changes of [
      { resources: [{ id: "chafing", capacity: 5 }, { id: "chafing", capacity: 5 }] },
      { requirements: [{ resourceId: "chafing", units: 3 }, { resourceId: "chafing", units: 1 }] },
      { reservations: [reservation("one", "2026-12-01T10:00:00-05:00", "2026-12-01T11:00:00-05:00", 1, "unknown")] },
      { reservations: [reservation("one", "2026-12-01T10:00:00-05:00", "2026-12-01T11:00:00-05:00"),
        reservation("one", "2026-12-01T12:00:00-05:00", "2026-12-01T13:00:00-05:00")] }
    ]) {
      assert.equal(assessEventResourceScenario(scenario(changes)).ok, false);
    }
  });
  it("never treats a user-supplied resource snapshot as an actual booking", () => {
    const result = assessEventResourceScenario(scenario());
    assert.equal(result.realProviderReadVerified, false);
    assert.equal(result.ownerApprovalRecorded, false);
    assert.equal(result.contactsNotified, false);
  });
});

describe("owner-only scenario APIs", () => {
  const routes = [
    ["/api/business/finance/microtransaction-scenario", merchant()],
    ["/api/business/nonprofits/contribution-review", nonprofit()],
    ["/api/business/events/resource-scenario", scenario()]
  ];
  for (const [path, payload] of routes) {
    it("gates " + path + " by real manager and org middleware", async () => {
      const denied = await request(appFor({ allowed: false })).post(path).send(payload);
      assert.equal(denied.status, 403);
      const orgless = await request(appFor({ organizationId: null })).post(path).send(payload);
      assert.equal(orgless.status, 403);
      const accepted = await request(appFor()).post(path).send(payload);
      assert.equal(accepted.status, 200);
      assert.equal(accepted.body.ok, true);
      assert.equal(accepted.headers["cache-control"], "private, no-store");
    });
  }
});

describe("business financial scenario owner pages", () => {
  it("shows operational forms with no execution controls", async () => {
    const result = await request(appFor()).get("/business-builder/owner/financial-scenarios");
    assert.equal(result.status, 200);
    assert.match(result.text, /Small-payment economics/);
    assert.match(result.text, /Nonprofit contribution review/);
    assert.match(result.text, /cannot charge customers, issue charitable receipts or trade securities/);
    assert.equal(result.headers["cache-control"], "private, no-store");
  });
  it("calculates a merchant scenario through the user-facing dollar form", async () => {
    const result = await request(appFor()).post("/business-builder/owner/financial-scenarios")
      .type("form").send({
        kind: "micro", price: "1.00", quantity: "100",
        minimum: "0.50", fixed_fee: "0.30", rate_percent: "2.90",
        delivery_cost: "0.10", risk_reserve: "0.05"
      });
    assert.equal(result.status, 200);
    assert.match(result.text, /\$0\.33/);
    assert.match(result.text, /\$0\.52/);
    assert.match(result.text, /No money was transferred/);
  });
  it("shows nonprofit disclosure thresholds while refusing to issue a receipt", async () => {
    const result = await request(appFor()).post("/business-builder/owner/financial-scenarios")
      .type("form").send({
        kind: "nonprofit", contribution: "250.00", benefit_value: "25.00",
        restricted: "yes"
      });
    assert.equal(result.status, 200);
    assert.match(result.text, /\$250\.00/);
    assert.match(result.text, /Restricted|restricted/);
    assert.match(result.text, /No money was transferred/);
  });
  it("fails closed on unsupported finance scenario, bad cents and absent organization", async () => {
    const bad = await request(appFor()).post("/business-builder/owner/financial-scenarios")
      .type("form").send({ kind: "micro", price: "1.111" });
    assert.equal(bad.status, 422);
    const unknown = await request(appFor()).post("/business-builder/owner/financial-scenarios")
      .type("form").send({ kind: "securities_trade" });
    assert.equal(unknown.status, 422);
    const denied = await request(appFor({ allowed: false }))
      .get("/business-builder/owner/financial-scenarios");
    assert.equal(denied.status, 403);
    const orgless = await request(appFor({ organizationId: null }))
      .post("/business-builder/owner/financial-scenarios")
      .type("form").send({ kind: "nonprofit", contribution: "100.00", benefit_value: "0" });
    assert.equal(orgless.status, 403);
  });
});
