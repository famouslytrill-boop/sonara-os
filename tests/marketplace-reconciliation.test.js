// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert = require("node:assert/strict");
const { reconcile, projectSession } = require("../lib/sonara-marketplace-reconciliation.cjs");
const checkout = require("../lib/sonara-connected-checkout.cjs");
const plainLanguage = require("../lib/sonara-plain-language.cjs");
const { registerMarketplaceReconciliationRoutes, RECONCILIATION_PAGE } = require("../routes/sonara-marketplace-reconciliation-routes.cjs");
const ORG = "aaaaaaaa-0000-4000-8000-00000000000a";
const OTHER = "bbbbbbbb-0000-4000-8000-00000000000b";
const BUYER = "cccccccc-0000-4000-8000-00000000000c";
const ORDER = "33333333-3333-4333-8333-333333333333";
const VERSION = "22222222-2222-4222-8222-222222222222";
const ACCOUNT = "acct_seller12345678";
const SESSION = "cs_test_sale123";
const INTENT = "pi_sale123";
const getEnv = (name) => ({
  STRIPE_CONNECT_ENABLED: "true",
  STRIPE_SECRET_KEY: "sk_test_" + "testfixture1234567890",
  STRIPE_CONNECT_WEBHOOK_SECRET: "whsec_" + "testfixture1234567890"
})[name] || "";

const order = (changes = {}) => ({ id: ORDER, organization_id: ORG, title: "A track",
  buyer_user_id: BUYER, version_id: VERSION, licence: "commercial_single", price_cents: 2500,
  currency: "usd", stripe_account_id: ACCOUNT, checkout_session_id: SESSION,
  payment_intent_id: INTENT, state: "paid", ...changes });
const grant = (changes = {}) => ({ order_id: ORDER, organization_id: ORG, buyer_user_id: BUYER,
  version_id: VERSION, licence: "commercial_single", revoked_at: null, revoked_reason: null, ...changes });
const session = (changes = {}) => ({ id: SESSION, client_reference_id: ORDER,
  metadata: { sonara_kind: "creator_marketplace", sonara_order_id: ORDER },
  amount_total: 2500, currency: "usd", payment_status: "paid", status: "complete",
  payment_intent: { id: INTENT, client_secret: "must-never-be-rendered",
    latest_charge: { id: "ch_sale123", payment_intent: INTENT, paid: true, captured: true, status: "succeeded", amount: 2500, currency: "usd", amount_refunded: 0,
      refunded: false, disputed: false, balance_transaction: { source: "ch_sale123", amount: 2500, currency: "usd", fee: 100, net: 2400 } } }, ...changes });
const run = (changes = {}) => reconcile({ organizationId: ORG, accountId: ACCOUNT,
  orderRows: [order()], grants: [grant()], sessions: [session()], ...changes });
const codes = (result) => result.rows[0].codes;
const refunded = (amount, disputed = false) => session({ payment_intent: {
  ...session().payment_intent, latest_charge: { ...session().payment_intent.latest_charge,
    amount_refunded: amount, refunded: amount === 2500, disputed }
} });

describe("marketplace sales are checked against payment and delivery evidence", () => {
  it("checks a paid order and its exact grant and keeps totals per currency", () => {
    const result = run();
    assert.deepEqual(codes(result), []);
    assert.equal(result.checked, 1);
    assert.deepEqual(result.totals.usd, { localPaid: 2500, stripePaid: 2500, refunded: 0 });
    assert.deepEqual(result.balances.usd, { fee: 100, net: 2400, charges: 1 });
  });
  it("projects only safe fields from expanded provider objects", () => {
    assert.doesNotMatch(JSON.stringify(run()), /client_secret|must-never-be-rendered|latest_charge/);
    assert.equal(projectSession(session()).intentId, INTENT);
  });
  it("requires the charge's own intent, successful capture and coherent refund evidence", () => {
    for (const change of [
      { payment_intent: "pi_other123" }, { payment_intent: null },
      { paid: false }, { captured: false }, { status: "failed" },
      { amount_refunded: 2501 }, { refunded: true, amount_refunded: 0 },
      { refunded: false, amount_refunded: 2500 }
    ]) {
      const value = session();
      Object.assign(value.payment_intent.latest_charge, change);
      const result = run({ sessions: [value] });
      assert.ok(codes(result).includes("charge_unverified"), JSON.stringify(change));
      assert.equal(result.unknownRefunds, 1);
      assert.deepEqual(result.balances, {});
    }
  });
  it("requires balance evidence to name the charge and satisfy net = amount - fee", () => {
    for (const change of [{ source: "ch_other123" }, { source: null },
      { amount: null }, { net: 2401 }, { fee: -1 }]) {
      const value = session();
      Object.assign(value.payment_intent.latest_charge.balance_transaction, change);
      const result = run({ sessions: [value] });
      assert.equal(result.unknownBalances, 1, JSON.stringify(change));
      assert.deepEqual(result.balances, {});
    }
  });
  it("does not count merchant or unrelated checkouts", () => {
    assert.equal(run({ sessions: [session({ metadata: { sonara_kind: "merchant_storefront", sonara_order_id: ORDER } })] }).totals.usd.stripePaid, 0);
    assert.equal(projectSession(session({ metadata: {} })), null);
  });
  it("deduplicates a repeated session without hiding two separate payments", () => {
    assert.equal(run({ sessions: [session(), session()] }).totals.usd.stripePaid, 2500);
    const twice = run({ sessions: [session(), session({ id: "cs_test_other123" })] });
    assert.ok(codes(twice).includes("duplicate_payment"));
    assert.equal(twice.totals.usd.stripePaid, 5000);
  });
  it("refuses contradictory copies of the same Stripe checkout while allowing exact pagination repeats", () => {
    const consistent = run({ sessions: [session(), session()] });
    assert.equal(consistent.complete, true);
    assert.equal(consistent.checked, 1);
    const conflicting = run({ sessions: [session(), session({ amount_total: 2700 })] });
    assert.ok(codes(conflicting).includes("checkout_evidence_conflict"));
    assert.equal(conflicting.complete, false);
    assert.equal(conflicting.attention, 1);
    // Total is drawn from the first snapshot, never overwritten by the
    // contradictory provider response. Either way the report is incomplete.
    assert.equal(conflicting.totals.usd.stripePaid, 2500);
  });
  it("flags contradictory checkout snapshots even without a local order", () => {
    const conflicting = run({
      orderRows: [], grants: [],
      sessions: [session(), session({ payment_status: "unpaid" })]
    });
    assert.ok(conflicting.rows[0].codes.includes("order_not_in_report"));
    assert.ok(conflicting.rows[0].codes.includes("checkout_evidence_conflict"));
    assert.equal(conflicting.complete, false);
  });
  it("reports missing webhook settlement and missing licence delivery separately", () => {
    assert.ok(codes(run({ orderRows: [order({ state: "pending", payment_intent_id: null })], grants: [] })).includes("payment_not_recorded"));
    assert.ok(codes(run({ grants: [] })).includes("licence_missing"));
  });
  it("does not call an absent payment missing when Stripe stopped at a page bound", () => {
    const result = run({ sessions: [], sessionsTruncated: true });
    assert.ok(codes(result).includes("payment_unverified"));
    assert.ok(!codes(result).includes("missing_payment"));
    assert.equal(result.complete, false);
  });
  it("does not call an absent grant missing when its read is incomplete", () => {
    assert.ok(codes(run({ grants: [], grantsComplete: false })).includes("licence_unverified"));
    assert.equal(run({ ordersTruncated: true }).complete, false);
  });
  it("refuses tenant contamination instead of returning another seller's data", () => {
    assert.throws(() => run({ orderRows: [order({ organization_id: OTHER })] }), /seller scope/);
    assert.throws(() => run({ grants: [grant({ organization_id: OTHER })] }), /seller scope/);
  });
  it("does not infer a missing payment on an earlier connected account", () => {
    assert.deepEqual(codes(run({ orderRows: [order({ stripe_account_id: "acct_previous12345678" })], sessions: [] })), ["other_account"]);
  });
  for (const [name, changed, expected] of [
    ["checkout", { id: "cs_test_other123" }, "checkout_mismatch"],
    ["reference", { client_reference_id: OTHER }, "reference_mismatch"],
    ["amount", { amount_total: 3500 }, "amount_mismatch"],
    ["currency", { currency: "eur" }, "amount_mismatch"],
    ["intent", { payment_intent: "pi_another123" }, "intent_mismatch"]
  ]) it("reports a different " + name, () => assert.ok(codes(run({ sessions: [session(changed)] })).includes(expected)));
  it("checks the grant's buyer, version and licence", () => {
    for (const changed of [{ buyer_user_id: OTHER }, { version_id: OTHER }, { licence: "exclusive_transfer" }]) {
      assert.ok(codes(run({ grants: [grant(changed)] })).includes("licence_mismatch"));
    }
  });
  it("flags duplicate licence grants rather than hiding one in a Map overwrite", () => {
    const result = run({ grants: [grant(), grant()] });
    assert.deepEqual(codes(result), ["licence_duplicate"]);
    assert.equal(result.checked, 0);
    assert.equal(result.attention, 1);
  });
  it("checks every duplicate grant's buyer, version, revocation and seller scope", () => {
    const mismatch = run({ grants: [grant(), grant({ buyer_user_id: OTHER })] });
    assert.ok(codes(mismatch).includes("licence_duplicate"));
    assert.ok(codes(mismatch).includes("licence_mismatch"));
    const revoked = run({ grants: [grant(), grant({
      revoked_at: "2026-10-08T09:00:00Z", revoked_reason: "disputed"
    })] });
    assert.ok(codes(revoked).includes("licence_duplicate"));
    assert.ok(codes(revoked).includes("licence_revoked"));
    assert.throws(() => run({ grants: [grant(), grant({ organization_id: OTHER })] }), /seller scope/);
  });
  it("does not let a refunded order look revoked when any duplicate remains active", () => {
    const closed = run({
      orderRows: [order({ state: "refunded" })],
      sessions: [refunded(2500)],
      grants: [
        grant({ revoked_at: "2026-10-08T09:00:00Z", revoked_reason: "refunded" }),
        grant()
      ]
    });
    assert.ok(codes(closed).includes("licence_duplicate"));
    assert.ok(codes(closed).includes("revocation_pending"));
    const allRevoked = run({
      orderRows: [order({ state: "refunded" })],
      sessions: [refunded(2500)],
      grants: [
        grant({ revoked_at: "2026-10-08T09:00:00Z", revoked_reason: "refunded" }),
        grant({ revoked_at: "2026-10-08T10:00:00Z", revoked_reason: "refunded" })
      ]
    });
    assert.ok(codes(allRevoked).includes("licence_duplicate"));
    assert.ok(!codes(allRevoked).includes("revocation_pending"));
  });
  it("reports full refunds and disputes which have not been recorded", () => {
    assert.ok(codes(run({ sessions: [refunded(2500)] })).includes("refund_not_recorded"));
    assert.ok(codes(run({ sessions: [refunded(0, true)] })).includes("dispute_not_recorded"));
  });
  it("records partial refund evidence without calling the licence fully refunded", () => {
    const result = run({ sessions: [refunded(500)] });
    assert.deepEqual(codes(result), []);
    assert.equal(result.totals.usd.refunded, 500);
  });
  it("reports failed revocation and recognizes a completed revocation", () => {
    const closed = { orderRows: [order({ state: "refunded" })], sessions: [refunded(2500)] };
    assert.ok(codes(run(closed)).includes("revocation_pending"));
    assert.deepEqual(codes(run({ ...closed, grants: [grant({ revoked_at: "2026-10-07T00:00:00Z", revoked_reason: "refunded" })] })), []);
  });
  it("keeps unknown fee and refund details unknown", () => {
    const result = run({ sessions: [session({ payment_intent: INTENT })] });
    assert.equal(result.unknownBalances, 1);
    assert.equal(result.unknownRefunds, 1);
    assert.deepEqual(result.balances, {});
    assert.ok(codes(result).includes("charge_unverified"));
  });
  it("does not mix original charge balance currency with sale currency", () => {
    const value = session();
    value.payment_intent.latest_charge.balance_transaction = { source: "ch_sale123", amount: 2195, currency: "eur", fee: 95, net: 2100 };
    const result = run({ sessions: [value] });
    assert.equal(result.totals.usd.stripePaid, 2500);
    assert.deepEqual(result.balances.eur, { fee: 95, net: 2100, charges: 1 });
  });
  it("calls an unmatched payment outside the report rather than inventing an absent order", () => {
    const result = run({ orderRows: [], grants: [] });
    assert.deepEqual(result.rows[0].codes, ["order_not_in_report"]);
  });
  it("keeps an unpaid open order waiting rather than claiming a confirmed sale", () => {
    const result = run({ orderRows: [order({ state: "pending", payment_intent_id: null })], grants: [], sessions: [] });
    assert.equal(result.rows[0].waiting, true);
    assert.equal(result.totals.usd, undefined);
  });
});

describe("Stripe reconciliation pagination is bounded and explicit", () => {
  it("uses the connected account and expands charge evidence across pages", async () => {
    const seen = [];
    const result = await checkout.listSessions({ getEnv }, { accountId: ACCOUNT, sinceSeconds: 100 }, async (url, init) => {
      seen.push({ url: new URL(url), init });
      return new Response(JSON.stringify({ data: [session({ id: seen.length === 1 ? SESSION : "cs_test_next123" })], has_more: seen.length === 1 }));
    });
    assert.equal(result.truncated, false);
    assert.equal(result.sessions.length, 2);
    assert.equal(seen[1].url.searchParams.get("starting_after"), SESSION);
    assert.equal(seen[0].url.searchParams.get("expand[]"), "data.payment_intent.latest_charge.balance_transaction");
    assert.equal(seen[0].init.headers["Stripe-Account"], ACCOUNT);
    assert.ok(seen.every((entry) => entry.init.method === "GET"));
  });
  it("marks the page limit as incomplete", async () => {
    const result = await checkout.listSessions({ getEnv }, { accountId: ACCOUNT, sinceSeconds: 100, maxPages: 1 },
      async () => new Response(JSON.stringify({ data: [session()], has_more: true })));
    assert.equal(result.truncated, true);
  });
  it("rejects an empty page which claims more records and a repeated cursor", async () => {
    const empty = await checkout.listSessions({ getEnv }, { accountId: ACCOUNT, sinceSeconds: 100 },
      async () => new Response(JSON.stringify({ data: [], has_more: true })));
    assert.deepEqual(empty, { ok: false, code: "malformed" });
    const repeated = await checkout.listSessions({ getEnv }, { accountId: ACCOUNT, sinceSeconds: 100 },
      async () => new Response(JSON.stringify({ data: [session()], has_more: true })));
    assert.deepEqual(repeated, { ok: false, code: "malformed" });
  });
});

function harness(options = {}) {
  let handler;
  const calls = [];
  const html = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const deps = {
    getEnv: options.getEnv || getEnv, getSupabaseServerConfig: () => ({ ok: true, url: "https://database.example.invalid" }),
    supabaseHeaders: () => ({ Authorization: "Bearer service-test-fixture" }),
    getCustomerPrimaryOrganization: options.resolveOrganization || (async (_user, scopeOptions) => {
      assert.equal(scopeOptions.autoBootstrap, false, "A sales check must not create a workspace");
      return options.organization || { ok: true, organizationId: ORG, role: "owner" };
    }),
    requireWorkspaceAccess: (key) => { assert.equal(key, "creator_studio"); return (_req, _res, next) => next(); },
    escapeHtml: html, linkAction: (href, label) => '<a href="' + href + '">' + label + "</a>",
    brandCard: (title, body) => "<section><h2>" + title + "</h2>" + body + "</section>",
    layout: (input) => "<h1>" + input.heading + "</h1><p>" + input.body + "</p>" + input.sections.join("") + input.actions.join("")
  };
  registerMarketplaceReconciliationRoutes({ get: (path, guard, render) => {
    assert.equal(path, RECONCILIATION_PAGE);
    assert.equal(typeof guard, "function");
    handler = render;
  } }, deps);
  const fetchImpl = async (raw, init) => {
    const url = new URL(raw);
    calls.push({ url, init });
    if (["/rest/v1/organization_memberships", "/rest/v1/business_memberships"].includes(url.pathname)) {
      return new Response("[]");
    }
    if (options.fail && url.pathname.includes(options.fail)) return new Response("{}", { status: 503 });
    if (url.host === "api.stripe.com") return new Response(JSON.stringify({
      data: options.sessions || [session()], has_more: false
    }));
    const rows = {
      "/rest/v1/creator_marketplace_orders": options.orders || [order()],
      "/rest/v1/business_payment_accounts": options.accounts || [{ organization_id: ORG, stripe_account_id: ACCOUNT }],
      "/rest/v1/creator_licence_grants": options.grants || [grant()]
    }[url.pathname];
    assert.ok(rows, "unexpected read: " + url.pathname);
    assert.equal(url.searchParams.get("organization_id"), "eq." + ORG);
    return new Response(JSON.stringify(rows));
  };
  return { handler, fetchImpl, calls };
}

describe("the seller can open a scoped reconciliation screen", () => {
  let originalFetch;
  beforeEach(() => { originalFetch = global.fetch; });
  afterEach(() => { global.fetch = originalFetch; });
  async function request(options = {}, query = {}) {
    const test = harness(options);
    global.fetch = test.fetchImpl;
    const res = { statusCode: 0, headers: {}, status(value) { this.statusCode = value; return this; },
      type() { return this; }, set(key, value) { this.headers[key] = value; return this; },
      send(body) { this.body = body; return this; } };
    await test.handler({ query, sonaraUser: { id: BUYER } }, res);
    const visible = res.body.replace(/<[^>]+>/g, " ");
    for (const term of plainLanguage.BANNED_ON_CUSTOMER_PAGES) {
      const escaped = term.replace(/[.*+?^\${}()|[\]\\]/g, "\\$&");
      assert.doesNotMatch(visible, new RegExp("\\b" + escaped, "i"), "Customer copy contains internal vocabulary: " + term);
    }
    return { ...test, res };
  }
  it("shows real fixture evidence without provider secrets and makes no writes", async () => {
    const { res, calls } = await request();
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers["Cache-Control"], "private, no-store");
    assert.match(res.body, /Records checked|original charge balance|Check again/);
    assert.doesNotMatch(res.body, /must-never-be-rendered|client_secret|Bearer/);
    assert.ok(calls.every((call) => !call.init.method || call.init.method === "GET"));
  });
  for (const [currency, gross, net] of [
    ["jpy", "¥2,500", "¥2,400"], ["mga", "MGA 2,500", "MGA 2,400"],
    ["isk", "ISK 25.00", "ISK 24.00"], ["ugx", "UGX 25.00", "UGX 24.00"]
  ]) it("renders sale and balance amounts using Stripe charge units for " + currency, async () => {
    const payment = session({ currency });
    payment.payment_intent.latest_charge.currency = currency;
    payment.payment_intent.latest_charge.balance_transaction.currency = currency;
    const { res } = await request({ orders: [order({ currency })], sessions: [payment] });
    assert.equal(res.statusCode, 200);
    assert.ok(res.body.replace(/\u00a0/g, " ").includes("Recorded paid orders: " + gross), res.body);
    assert.ok(res.body.replace(/\u00a0/g, " ").includes("Original charge net: " + net), res.body);
  });
  // SONARA_CUSTOMER_FUNDS_MODE closes NEW merchant checkout unless the owner
  // approves it, and the fixture environment leaves it unset. Sales a business
  // already has still have to be checkable, which is why historical Stripe
  // reads stay open on a key alone; this screen used to ask checkoutReadiness
  // first and so refused whenever new checkout was off.
  it("checks existing sales while new checkout is closed", async () => {
    assert.equal(checkout.checkoutReadiness({ getEnv }).ok, false, "the fixture no longer represents checkout being closed");
    const { res, calls } = await request();
    assert.equal(res.statusCode, 200);
    assert.ok(calls.some((call) => call.url.host === "api.stripe.com"), "Stripe was not read");
  });
  it("says the payment connection is unavailable when there is no key to read with", async () => {
    const noKey = (name) => (name === "STRIPE_SECRET_KEY" ? "" : getEnv(name));
    const { res, calls } = await request({ getEnv: noKey });
    assert.equal(res.statusCode, 503);
    assert.match(res.body, /payment connection is unavailable/);
    assert.ok(!calls.some((call) => call.url.host === "api.stripe.com"), "Stripe was called without a key");
  });
  it("reads nothing when the authenticated workspace cannot be resolved", async () => {
    const { res, calls } = await request({ organization: { ok: false } });
    assert.equal(res.statusCode, 503);
    assert.equal(calls.length, 0);
  });
  it("does not bootstrap a workspace when both membership reads are empty", async () => {
    const { createCustomerPrimaryOrganizationResolver } = require("../lib/sonara-customer-organization.cjs");
    const resolveOrganization = createCustomerPrimaryOrganizationResolver({
      getSupabaseServerConfig: () => ({ ok: true, url: "https://database.example.invalid" }),
      supabaseHeaders: () => ({})
    });
    const { res, calls } = await request({ resolveOrganization });
    assert.equal(res.statusCode, 503);
    assert.equal(calls.length, 2);
    assert.ok(calls.every((call) => (!call.init.method || call.init.method === "GET")
      && call.url.pathname.endsWith("_memberships")));
  });
  it("refuses staff and ordinary members before sales or provider records are read", async () => {
    for (const role of ["employee", "member", "customer", "other"]) {
      const { res, calls } = await request({ organization: { ok: true, organizationId: ORG, role } });
      assert.equal(res.statusCode, 403, role);
      assert.equal(calls.length, 0);
      assert.match(res.body, /owner, admin or manager/);
    }
  });
  it("keeps an unverified role separate from a successful sales check", async () => {
    for (const role of [null, undefined, ""]) {
      const { res, calls } = await request({ organization: { ok: true, organizationId: ORG, role } });
      assert.equal(res.statusCode, 503);
      assert.equal(calls.length, 0);
      assert.doesNotMatch(res.body, /No records in this period|Records checked/);
    }
  });
  it("allows verified owners, admins and managers within their own workspace", async () => {
    for (const role of ["owner", "admin", "manager"]) {
      const { res } = await request({ organization: { ok: true, organizationId: ORG, role } });
      assert.equal(res.statusCode, 200, role);
      assert.match(res.body, /Records checked/);
    }
  });
  it("rejects a request-supplied period before any data read", async () => {
    const { res, calls } = await request({}, { days: "999", organizationId: OTHER });
    assert.equal(res.statusCode, 400);
    assert.equal(calls.length, 0);
  });
  it("ignores a request-supplied workspace and escapes sale titles", async () => {
    for (const title of ["<script>bad()</script>", "<SCRIPT >bad()</SCRIPT >", "<script src=x>bad()</script>"]) {
      const { res } = await request({ orders: [order({ title })] }, { organizationId: OTHER });
      assert.match(res.body, /&lt;script/i);
      assert.doesNotMatch(res.body, /<script\b/i);
    }
  });
  for (const fail of ["creator_marketplace_orders", "creator_licence_grants", "checkout/sessions"]) {
    it("reports a failed " + fail + " read instead of an empty successful report", async () => {
      const { res } = await request({ fail });
      assert.equal(res.statusCode, 503);
      assert.doesNotMatch(res.body, /No records in this period|Records checked/);
    });
  }
  it("never calls Stripe for an account outside the authenticated workspace", async () => {
    const { res, calls } = await request({ accounts: [{ organization_id: OTHER, stripe_account_id: ACCOUNT }] });
    assert.equal(res.statusCode, 503);
    assert.ok(calls.every((call) => call.url.host !== "api.stripe.com"));
  });
  it("separates no account from a verified report", async () => {
    const { res } = await request({ accounts: [] });
    assert.equal(res.statusCode, 200);
    assert.match(res.body, /reconciliation has not run/);
  });
  it("uses Stripe minor units for zero-decimal and compatibility currencies", async () => {
    for (const [currency, shown] of [["jpy", "¥500"], ["isk", "ISK 5"], ["ugx", "UGX 5"]]) {
      const value = session({ amount_total: 500, currency });
      value.payment_intent.latest_charge = { ...value.payment_intent.latest_charge,
        amount: 500, currency, balance_transaction: { currency, fee: 100, net: 400 } };
      const { res } = await request({ orders: [order({ price_cents: 500, currency })], sessions: [value] });
      assert.equal(res.statusCode, 200);
      assert.ok(res.body.replace(/\u00a0/g, " ").includes("Recorded paid orders: " + shown), currency + " was scaled incorrectly");
    }
  });
});
