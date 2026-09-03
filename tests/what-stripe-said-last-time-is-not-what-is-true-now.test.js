"use strict";

// `cacheAccountState` in `lib/sonara-connected-payments.cjs` was exported,
// documented, and **called from nowhere**. Not by a route, not by another
// module, not by a test. Checked across the whole repository.
//
// So the four columns it fills -- `charges_enabled`, `payouts_enabled`,
// `details_submitted`, `state_checked_at` -- were null on every row in
// production, `readAccount` fetched them anyway with `select=*`, and nothing
// read them. A function that is exported, looks finished, and is invoked by
// nothing is the shape this repository keeps finding, and the module-level
// reachability check cannot see it: `report-unreferenced-modules` asks whether
// the *module* is referenced, and this one is.
//
// The migration says what the columns are for, and it is worth having:
//
//   charges_enabled boolean,   -- "Nullable on purpose: null means 'never
//                                 asked', false means 'Stripe said no'."
//   state_checked_at timestamptz,  -- "A cached flag with no timestamp beside
//                                     it is a number with nothing saying how
//                                     old it is."
//
// They are now written by the connected-payments page after Stripe answers, and
// read by that page's last branch -- the one that runs when Stripe cannot be
// reached, which used to say only "Could not check".
//
// Two things this must never become, and both are tested below:
//
//   1. The cache must not decide whether a payment may be taken. A stale
//      `charges_enabled: true` renders a pay button on an account that cannot
//      take money. `canAcceptPayments` still asks Stripe every time.
//   2. The remembered answer must never be presented as the current one. It is
//      shown with its date, under a heading that still says the check did not
//      happen.

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const registerConnectedPaymentRoutes = require("../routes/sonara-connected-payment-routes.cjs");
const payments = require("../lib/sonara-connected-payments.cjs");

const ORG = "11111111-1111-4111-8111-111111111111";
const ACCOUNT = "acct_1ExampleAccount";
const USER = { id: "55555555-5555-4555-8555-555555555555" };
const PAGE = registerConnectedPaymentRoutes.PAGE;

const CHECKED_AT = "2026-09-01T14:32:00Z";

// Read off connectReadiness rather than invented: the feature is opt-in behind
// STRIPE_CONNECT_ENABLED, and the key is rejected under 20 characters or with a
// placeholder prefix. A harness with the wrong names renders "Not available
// yet" and every assertion below would be measuring that page instead.
const ENV = Object.freeze({
  STRIPE_CONNECT_ENABLED: "true",
  STRIPE_SECRET_KEY: "sk_test_not_a_placeholder_1234567890"
});

function accountRow(over = {}) {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    stripe_account_id: ACCOUNT,
    charges_enabled: true,
    payouts_enabled: false,
    details_submitted: true,
    state_checked_at: CHECKED_AT,
    ...over
  };
}

const isAccounts = (call) => call.url.includes("business_payment_accounts");
const isStripe = (call) => call.url.includes("stripe.com");

/**
 * The page, with only `fetch` replaced. The real route calls the real
 * connected-payments module, so every assertion below is about a request the
 * application would really send.
 */
function harness({ rows = [accountRow()], stripe = { ok: true, body: { charges_enabled: true, payouts_enabled: true, details_submitted: true } }, patch = { ok: true } } = {}) {
  const sent = [];
  const app = express();
  app.use(express.urlencoded({ extended: false }));

  const previousFetch = global.fetch;
  global.fetch = async (url, init = {}) => {
    const call = { url: String(url), method: (init.method || "GET").toUpperCase(), body: init.body ? String(init.body) : null };
    sent.push(call);
    if (isStripe(call)) {
      if (!stripe) throw new Error("stripe unreachable");
      return { ok: stripe.ok, status: stripe.ok ? 200 : 503, json: async () => stripe.body ?? {} };
    }
    if (call.method === "PATCH") return { ok: patch.ok, status: patch.ok ? 204 : 500, json: async () => [] };
    return { ok: true, status: 200, json: async () => rows };
  };

  registerConnectedPaymentRoutes(app, {
    layout: ({ heading, sections = [] }) => `<main><h1>${heading || ""}</h1>${sections.join("")}</main>`,
    brandCard: (title, body) => `<article><h2>${title}</h2><p>${body}</p></article>`,
    escapeHtml: (value) => String(value),
    requireCustomer: (req, _res, next) => { req.sonaraUser = USER; next(); },
    getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId: ORG }),
    getSupabaseServerConfig: () => ({ ok: true, url: "https://db.example" }),
    supabaseHeaders: () => ({ apikey: "service-role" }),
    getEnv: (name) => ENV[name] || ""
  });

  return { app, sent, restore: () => { global.fetch = previousFetch; } };
}

describe("what Stripe said last time is not what is true now", () => {
  let live = null;
  afterEach(() => {
    if (live) live.restore();
    live = null;
  });

  it("has a cache function that something calls", () => {
    // The finding itself, kept as a check. `cacheAccountState` was exported and
    // invoked by nothing; this asserts the page still calls it, so it cannot
    // quietly go back to being dead.
    const source = require("node:fs").readFileSync(
      require("node:path").join(__dirname, "..", "routes", "sonara-connected-payment-routes.cjs"),
      "utf8"
    );
    assert.equal(typeof payments.cacheAccountState, "function");
    assert.match(source, /payments\.cacheAccountState\(/, "nothing calls cacheAccountState again; the four cached columns are dead");
  });

  describe("reading the account", () => {
    it("names the columns it wants instead of asking for all of them", async () => {
      live = harness();
      await request(live.app).get(PAGE).set("Accept", "text/html");
      const read = live.sent.find((call) => isAccounts(call) && call.method === "GET");
      assert.ok(read, "the account was never read");
      assert.ok(!read.url.includes("select=*"), "the account read still asks for every column");
      for (const column of ["stripe_account_id", "charges_enabled", "payouts_enabled", "state_checked_at"]) {
        assert.ok(read.url.includes(column), `${column} is not in the select, and the fallback below needs it`);
      }
    });

    it("scopes the read to this organization and to a live connection", async () => {
      live = harness();
      await request(live.app).get(PAGE).set("Accept", "text/html");
      const read = live.sent.find((call) => isAccounts(call) && call.method === "GET");
      assert.match(read.url, new RegExp(`organization_id=eq\\.${ORG}`));
      assert.match(read.url, /disconnected_at=is\.null/, "a disconnected account would be read as the current one");
    });
  });

  describe("remembering what Stripe said", () => {
    it("writes the answer onto the row after a successful check", async () => {
      live = harness();
      const res = await request(live.app).get(PAGE).set("Accept", "text/html");
      assert.equal(res.status, 200);
      const write = live.sent.find((call) => isAccounts(call) && call.method === "PATCH");
      assert.ok(write, "Stripe answered and nothing was remembered");
      const body = JSON.parse(write.body);
      assert.equal(body.charges_enabled, true);
      assert.equal(body.payouts_enabled, true);
      assert.ok(body.state_checked_at, "the flags were cached with nothing saying when");
    });

    it("does not write anything when Stripe could not be asked", async () => {
      // Caching a failure would overwrite a real earlier answer with nulls, and
      // the fallback would then have less to say than before.
      live = harness({ stripe: { ok: false } });
      await request(live.app).get(PAGE).set("Accept", "text/html");
      assert.ok(!live.sent.some((call) => isAccounts(call) && call.method === "PATCH"), "a failed check was written to the row");
    });

    it("still renders the page when the cache write fails", async () => {
      // The write is a convenience for next time. A page that 500s because it
      // could not remember something is worse than one that forgets.
      live = harness({ patch: { ok: false } });
      const res = await request(live.app).get(PAGE).set("Accept", "text/html");
      assert.equal(res.status, 200);
      assert.match(res.text, /able to take payments/);
    });
  });

  describe("when Stripe cannot be reached", () => {
    it("says what was true last time, and when", async () => {
      live = harness({ stripe: { ok: false }, rows: [accountRow({ charges_enabled: true, payouts_enabled: false })] });
      const res = await request(live.app).get(PAGE).set("Accept", "text/html");
      assert.equal(res.status, 200);
      assert.match(res.text, /Could not check/, "the heading must still say the check did not happen");
      assert.match(res.text, /charges were enabled/);
      assert.match(res.text, /payouts were not enabled/, "false and null are different answers and must read differently");
      assert.match(res.text, /2026-09-01 14:32/, "a remembered answer with no date asks somebody to trust a number they cannot date");
      assert.match(res.text, /not the same as what is true now/);
    });

    it("does not claim the account can take payments", async () => {
      // The line between reporting and deciding. Even with charges_enabled
      // cached as true, this page must not render the connected-and-able card.
      live = harness({ stripe: { ok: false }, rows: [accountRow({ charges_enabled: true })] });
      const res = await request(live.app).get(PAGE).set("Accept", "text/html");
      assert.doesNotMatch(res.text, /Connected and able to take payments/);
      assert.doesNotMatch(res.text, /Disconnect this account/, "a page that could not check must not offer the actions that depend on knowing");
    });

    it("says nothing extra when there is nothing remembered", async () => {
      // A row that has never been checked has state_checked_at null. Saying
      // "when we last asked" about a check that never happened is worse than
      // saying nothing.
      live = harness({ stripe: { ok: false }, rows: [accountRow({ state_checked_at: null, charges_enabled: null, payouts_enabled: null })] });
      const res = await request(live.app).get(PAGE).set("Accept", "text/html");
      assert.match(res.text, /Could not check/);
      assert.doesNotMatch(res.text, /When we last asked/);
    });

    it("does not turn a null flag into a negative one", async () => {
      // null means never asked; false means Stripe said no. A cache that
      // renders both as "not enabled" tells a business owner their payouts are
      // switched off when nobody has looked.
      live = harness({
        stripe: { ok: false },
        rows: [accountRow({ charges_enabled: true, payouts_enabled: null })]
      });
      const res = await request(live.app).get(PAGE).set("Accept", "text/html");
      assert.match(res.text, /charges were enabled/);
      assert.doesNotMatch(res.text, /payouts were not enabled/, "a payout flag nobody has read was rendered as disabled");
    });
  });

  describe("the cache never decides whether money may be taken", () => {
    it("asks Stripe on every payment check, whatever the row says", async () => {
      // canAcceptPayments is the function every payment path calls. Cached
      // flags saying yes must not shortcut it: a stale true renders a pay
      // button on an account that cannot take money.
      live = harness({ rows: [accountRow({ charges_enabled: true })] });
      const mod = {
        supabaseUrl: "https://db.example",
        serviceRoleHeaders: () => ({ apikey: "service-role" }),
        getEnv: (name) => ENV[name] || ""
      };
      const answer = await payments.canAcceptPayments(mod, ORG);
      assert.ok(live.sent.some(isStripe), "no request went to Stripe; the decision was made from the cached row");
      assert.equal(answer.ok, true);
    });

    it("refuses when Stripe cannot be asked, even with the row saying charges are enabled", async () => {
      live = harness({ rows: [accountRow({ charges_enabled: true })], stripe: { ok: false } });
      const mod = {
        supabaseUrl: "https://db.example",
        serviceRoleHeaders: () => ({ apikey: "service-role" }),
        getEnv: (name) => ENV[name] || ""
      };
      const answer = await payments.canAcceptPayments(mod, ORG);
      assert.equal(answer.ok, false, "a cached true allowed a payment when Stripe could not be asked");
      assert.match(answer.detail, /nothing here will claim it can/);
    });
  });
});
