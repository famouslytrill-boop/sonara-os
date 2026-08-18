"use strict";

// The billing page told a customer their plan was active and nothing else.
//
// getBillingPanelSummary selected `current_period_end` and never used it, so the
// page fetched the renewal date and did not show it -- the second thing anybody
// opens their own billing to see. `cancel_at_period_end` was worse: the Stripe
// webhook has always written it and nothing had ever asked for it, so somebody
// who had already cancelled read "Core monthly: active" and nothing about it
// ending. True, and misleading in the direction that costs a support ticket.
//
// Found by scripts/report-unused-selected-columns.mjs, which exists because the
// same shape -- a column fetched into a decision and never used -- hid the
// consent-scope gate going unchecked.

const assert = require("node:assert/strict");
const { createBilling } = require("../lib/sonara-billing.cjs");

const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";

function billingWith(rows, { readable = true } = {}) {
  const module = createBilling({
    STRIPE_PLANS: { free: { name: "Free", amount: 0 }, core_monthly: { name: "Core", amount: 1900 } },
    getEnv: () => "",
    getPublicAppUrl: () => "https://example.test",
    getSafeAbsoluteUrl: (value) => value,
    getSupabaseServerConfig: () => ({ ok: true, url: "https://project.supabase.co", serviceRoleKey: "server-only" }),
    supabaseHeaders: () => ({}),
    safeCountTable: async () => ({ ok: true, count: 0 }),
    formatMetric: (label, value) => `${label}: ${value}`,
    insertActivityEvent: async () => ({ ok: true })
  });
  global.fetch = async () => (readable
    ? { ok: true, status: 200, json: async () => rows }
    : { ok: false, status: 503, json: async () => ({}) });
  return module.getBillingPanelSummary(ORGANIZATION_ID);
}

const RENEWS = Object.freeze({ plan_slug: "core_monthly", status: "active", current_period_end: "2026-09-14T10:30:00Z", cancel_at_period_end: false });

describe("a billing page says what happens next", () => {
  let realFetch;

  before(() => {
    realFetch = global.fetch;
  });

  after(() => {
    global.fetch = realFetch;
  });

  it("asks Supabase for both halves of the answer", async () => {
    let requested = "";
    const module = createBilling({
      STRIPE_PLANS: { core_monthly: { name: "Core", amount: 1900 } },
      getEnv: () => "",
      getPublicAppUrl: () => "https://example.test",
      getSafeAbsoluteUrl: (value) => value,
      getSupabaseServerConfig: () => ({ ok: true, url: "https://project.supabase.co", serviceRoleKey: "server-only" }),
      supabaseHeaders: () => ({}),
      safeCountTable: async () => ({ ok: true, count: 0 }),
      formatMetric: (label, value) => `${label}: ${value}`,
      insertActivityEvent: async () => ({ ok: true })
    });
    global.fetch = async (url) => {
      requested = String(url);
      return { ok: true, status: 200, json: async () => [] };
    };
    await module.getBillingPanelSummary(ORGANIZATION_ID);
    assert.match(requested, /current_period_end/);
    assert.match(requested, /cancel_at_period_end/, "the cancellation flag is written by the webhook and was never asked for");
  });

  it("says when a running plan renews", async () => {
    const summary = await billingWith([RENEWS]);
    assert.equal(summary.ok, true);
    assert.match(summary.status, /Renews 2026-09-14/, `read: ${summary.status}`);
  });

  // The one that was actively misleading.
  it("says a cancelled plan is ending, rather than only that it is active", async () => {
    const summary = await billingWith([{ ...RENEWS, cancel_at_period_end: true }]);
    assert.match(summary.status, /ends 2026-09-14/, `read: ${summary.status}`);
    assert.match(summary.status, /will not renew/);
    assert.doesNotMatch(summary.status, /Renews/, "a cancelled plan was described as renewing");
  });

  // Absent is not false. A row whose cancellation flag did not come back must
  // not be reported as renewing -- that is the same guess, in the direction
  // that reassures.
  it("does not claim a plan renews when the row does not say", async () => {
    for (const missing of [{ ...RENEWS, cancel_at_period_end: null }, { plan_slug: "core_monthly", status: "active", current_period_end: RENEWS.current_period_end }]) {
      const summary = await billingWith([missing]);
      assert.match(summary.status, /This period ends 2026-09-14/, `read: ${summary.status}`);
      assert.doesNotMatch(summary.status, /Renews|will not renew/, "the page answered a question the row did not");
    }
  });

  it("says nothing about dates when there is no date", async () => {
    const summary = await billingWith([{ plan_slug: "core_monthly", status: "active", cancel_at_period_end: false }]);
    assert.match(summary.status, /Core monthly: Active/);
    assert.doesNotMatch(summary.status, /Renews|ends|period/i, "a month ahead was guessed from nothing");
  });

  it("does not turn an unparseable timestamp into a date", async () => {
    const summary = await billingWith([{ ...RENEWS, current_period_end: "not a date" }]);
    assert.doesNotMatch(summary.status, /NaN|Invalid|1970/, `read: ${summary.status}`);
    assert.doesNotMatch(summary.status, /Renews/);
  });

  // The protection this function already had, which the change must not cost
  // it. A failed read is not "you have no plan".
  it("still refuses to describe a plan it could not read", async () => {
    const summary = await billingWith([], { readable: false });
    assert.equal(summary.ok, false);
    assert.match(summary.status, /could not check your plan/i);
    assert.doesNotMatch(summary.status, /No active paid plan/, "an outage was reported as an unpaid customer");
  });

  it("still says plainly when there is genuinely no plan", async () => {
    const summary = await billingWith([]);
    assert.equal(summary.ok, true);
    assert.equal(summary.status, "No active paid plan found.");
  });
});
