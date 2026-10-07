"use strict";

// The decisions on the marketplace money path, one at a time.
//
// lib/sonara-marketplace-orders.cjs decides whether a buyer may start a purchase,
// what a Stripe event means for an order, and whether a person may download a
// file. lib/sonara-connected-checkout.cjs is the one call to Stripe. Neither
// renders or stores anything, so each decision can be asked directly with the
// inputs that would make it wrong -- which is what this file does.
//
// tests/buying-a-licence-end-to-end.test.js drives the same chain through the
// real server, the real tenant guard and a signed webhook. This file is where a
// single wrong comparison shows up by name.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const orders = require("../lib/sonara-marketplace-orders.cjs");
const checkout = require("../lib/sonara-connected-checkout.cjs");

const SELLER = "aaaaaaaa-0000-4000-8000-00000000000a";
const BUYER = "cccccccc-0000-4000-8000-00000000000c";
const STRANGER = "dddddddd-0000-4000-8000-00000000000d";
const LISTING = "11111111-1111-4111-8111-111111111111";
const VERSION = "22222222-2222-4222-8222-222222222222";
const ORDER = "33333333-3333-4333-8333-333333333333";
const ACCOUNT = "acct_seller12345678";
const SESSION = "cs_test_a1b2c3d4e5";
const INTENT = "pi_test12345678";

const LISTING_ROW = Object.freeze({
  id: LISTING, organization_id: SELLER, title: "A track", price_cents: 2500, currency: "usd",
  licence: "commercial_single", state: "listed", rights_attested: true, consent_attested: null, version_id: VERSION
});
const VERSION_ROW = Object.freeze({ id: VERSION, assetId: "a1", versionNumber: 1, source: "uploaded", aiDisclosure: null, provenance: { involves_person: false } });
const APPROVED = Object.freeze([{ state: "approved", decidedAt: "2026-10-01T00:00:00Z", decidedBy: "u2", createdAt: "2026-10-01T00:00:00Z" }]);
const PIN = Object.freeze({ version_id: VERSION, object_path: `${SELLER}/versions/x-a-track.wav` });
const PAYABLE = Object.freeze({ ok: true, accountId: ACCOUNT });

function purchase(overrides = {}) {
  return orders.purchaseDecision({
    listing: LISTING_ROW, version: VERSION_ROW, approvals: APPROVED, storefrontCurrency: "usd",
    versionFile: PIN, payment: PAYABLE, buyerUserId: BUYER, now: new Date("2026-10-05T12:00:00Z"),
    ...overrides
  });
}

const ORDER_ROW = Object.freeze({
  id: ORDER, organization_id: SELLER, listing_id: LISTING, version_id: VERSION, buyer_user_id: BUYER,
  licence: "commercial_single", price_cents: 2500, currency: "usd", stripe_account_id: ACCOUNT,
  checkout_session_id: SESSION, payment_intent_id: null, state: "pending"
});

function sessionEvent(type, object = {}, event = {}) {
  return {
    id: "evt_test1", type, account: ACCOUNT,
    data: { object: {
      id: SESSION, client_reference_id: ORDER, metadata: { sonara_order_id: ORDER, sonara_kind: "creator_marketplace" },
      amount_total: 2500, currency: "usd", payment_status: "paid", payment_intent: INTENT, ...object
    } },
    ...event
  };
}

describe("a sale is a licence delivered", () => {
  describe("pinning the file a version will deliver", () => {
    const FILE = { path: `${SELLER}/assets/a.wav`, bytes: 1024, sha256: "A".repeat(64) };

    it("refuses a missing file or one with no size", () => {
      assert.equal(orders.pinDecision({ version: VERSION_ROW, assetFile: null }).code, "no_file");
      for (const bytes of [0, null, undefined, "", -1, "x"]) {
        assert.equal(orders.pinDecision({ version: VERSION_ROW, assetFile: { ...FILE, bytes } }).ok, false, `bytes ${bytes} was accepted`);
      }
    });

    it("refuses a file whose checksum disagrees with the version's", () => {
      const decision = orders.pinDecision({ version: { checksum: "b".repeat(64) }, assetFile: FILE });
      assert.equal(decision.ok, false);
      assert.equal(decision.code, "checksum_mismatch");
    });

    it("matches a checksum however it is prefixed or cased, and says it was verified", () => {
      const decision = orders.pinDecision({ version: { checksum: `sha256:${"a".repeat(64)}` }, assetFile: FILE });
      assert.deepEqual([decision.ok, decision.code, decision.verified], [true, "match", true]);
    });

    it("pins an unverifiable file but says so, rather than calling it a match", () => {
      for (const [checksum, sha256] of [[null, FILE.sha256], ["a".repeat(64), null], ["not-a-checksum", FILE.sha256]]) {
        const decision = orders.pinDecision({ version: { checksum }, assetFile: { ...FILE, sha256 } });
        assert.deepEqual([decision.ok, decision.code, decision.verified], [true, "not_recorded", false]);
      }
    });
  });

  describe("starting a purchase", () => {
    it("snapshots the listing, the version and the seller's account, and nothing else", () => {
      const decision = purchase();
      assert.equal(decision.ok, true);
      assert.deepEqual(Object.keys(decision.order).sort(), [
        "buyer_user_id", "currency", "expires_at", "licence", "listing_id", "organization_id",
        "price_cents", "state", "stripe_account_id", "title", "version_id"
      ]);
      assert.equal(decision.order.organization_id, SELLER);
      assert.equal(decision.order.price_cents, 2500);
      assert.equal(decision.order.stripe_account_id, ACCOUNT);
      assert.equal(decision.order.state, "pending");
      assert.equal(decision.order.expires_at, "2026-10-05T12:30:00.000Z", "the order must expire with Stripe's checkout session, 30 minutes on");
    });

    it("asks the buyer to sign in, and never takes an anonymous order", () => {
      for (const buyerUserId of [undefined, null, "", "not-a-uuid"]) assert.equal(purchase({ buyerUserId }).code, "sign_in");
    });

    it("refuses what is not on sale or no longer cleared", () => {
      assert.equal(purchase({ listing: { ...LISTING_ROW, state: "withdrawn" } }).code, "not_on_sale");
      assert.equal(purchase({ listing: null }).code, "not_on_sale");
      assert.equal(purchase({ approvals: [] }).code, "not_cleared");
      assert.equal(purchase({ listing: { ...LISTING_ROW, rights_attested: false } }).code, "not_cleared");
    });

    it("refuses a version with no pinned file, or a pin belonging to another version", () => {
      assert.equal(purchase({ versionFile: null }).code, "no_delivery_file");
      assert.equal(purchase({ versionFile: { ...PIN, version_id: "99999999-2222-4222-8222-222222222222" } }).code, "no_delivery_file");
      assert.equal(purchase({ versionFile: { ...PIN, object_path: "" } }).code, "no_delivery_file");
    });

    it("refuses a seller Stripe has not confirmed can take charges", () => {
      for (const payment of [null, { ok: false, code: "charges_disabled" }, { ok: true }, { ok: true, accountId: "acct_" }, { ok: "true", accountId: ACCOUNT }]) {
        assert.equal(purchase({ payment }).code, "seller_cannot_take_payment", JSON.stringify(payment));
      }
    });
  });

  describe("the checkout Stripe is asked to open", () => {
    const fields = orders.checkoutFields({ ...purchase().order, id: ORDER }, { successUrl: "https://s/ok", cancelUrl: "https://s/no" });

    it("takes no commission", () => {
      assert.ok(Object.keys(fields).length >= 10, "no fields; this check has gone blind");
      assert.deepEqual(Object.keys(fields).filter((key) => /application_fee|transfer_data|on_behalf_of/.test(key)), []);
    });

    it("carries the order so the webhook can find it, and the snapshot amount", () => {
      assert.equal(fields.client_reference_id, ORDER);
      assert.equal(fields["metadata[sonara_order_id]"], ORDER);
      assert.equal(fields["metadata[sonara_kind]"], "creator_marketplace");
      assert.equal(fields["line_items[0][price_data][unit_amount]"], "2500");
      assert.equal(fields["line_items[0][price_data][currency]"], "usd");
      assert.equal(fields.mode, "payment");
      assert.equal(fields.expires_at, String(Date.parse("2026-10-05T12:30:00Z") / 1000));
    });
  });

  describe("what a verified Stripe event means", () => {
    const decide = (event, order = ORDER_ROW) => orders.fulfilmentDecision({ event, order });

    it("grants a paid checkout whose every field matches the order", () => {
      const decision = decide(sessionEvent("checkout.session.completed"));
      assert.deepEqual([decision.action, decision.code, decision.paymentIntentId], ["grant", "paid", INTENT]);
      assert.equal(decide(sessionEvent("checkout.session.async_payment_succeeded"), { ...ORDER_ROW, state: "processing" }).action, "grant");
    });

    // Each of these is genuine-looking and wrong in exactly one field. A
    // signature says Stripe sent it, not that it is about this order.
    for (const [why, event, code] of [
      ["came from another connected account", sessionEvent("checkout.session.completed", {}, { account: "acct_someoneelse99" }), "account_mismatch"],
      ["came from the platform account itself", sessionEvent("checkout.session.completed", {}, { account: undefined }), "account_mismatch"],
      ["names another checkout session", sessionEvent("checkout.session.completed", { id: "cs_test_other999" }), "session_mismatch"],
      ["names another order in client_reference_id", sessionEvent("checkout.session.completed", { client_reference_id: STRANGER }), "order_mismatch"],
      ["names another order in metadata", sessionEvent("checkout.session.completed", { metadata: { sonara_order_id: STRANGER } }), "order_mismatch"],
      ["paid a different amount", sessionEvent("checkout.session.completed", { amount_total: 1 }), "amount_mismatch"],
      ["paid with no amount at all", sessionEvent("checkout.session.completed", { amount_total: undefined }), "amount_mismatch"],
      ["paid in a different currency", sessionEvent("checkout.session.completed", { currency: "eur" }), "currency_mismatch"]
    ]) {
      it(`grants nothing for an event that ${why}`, () => {
        const decision = decide(event);
        assert.equal(decision.action, "ignore");
        assert.equal(decision.code, code);
      });
    }

    it("holds a completed-but-unpaid checkout as processing, never as paid", () => {
      assert.deepEqual(Object.values(decide(sessionEvent("checkout.session.completed", { payment_status: "unpaid" }))), ["processing", "not_yet_paid"]);
      assert.equal(decide(sessionEvent("checkout.session.completed", { payment_status: "no_payment_required" })).action, "processing");
    });

    it("grants again for an order already paid, so a failed grant write is completed by the retry", () => {
      assert.deepEqual([decide(sessionEvent("checkout.session.completed"), { ...ORDER_ROW, state: "paid" }).action], ["grant"]);
    });

    it("never revives a refunded, disputed, failed or expired order", () => {
      for (const state of ["refunded", "disputed", "payment_failed", "expired"]) {
        assert.equal(decide(sessionEvent("checkout.session.completed"), { ...ORDER_ROW, state }).action, "ignore", state);
      }
    });

    it("expires only a pending order, so a delayed payment keeps its hold", () => {
      assert.equal(decide(sessionEvent("checkout.session.expired")).action, "expire");
      assert.equal(decide(sessionEvent("checkout.session.expired"), { ...ORDER_ROW, state: "processing" }).action, "ignore");
      assert.equal(decide(sessionEvent("checkout.session.expired"), { ...ORDER_ROW, state: "paid" }).action, "ignore");
    });

    it("fails an open order whose delayed payment failed, and nothing else", () => {
      assert.equal(decide(sessionEvent("checkout.session.async_payment_failed"), { ...ORDER_ROW, state: "processing" }).action, "fail");
      assert.equal(decide(sessionEvent("checkout.session.async_payment_failed"), { ...ORDER_ROW, state: "paid" }).action, "ignore");
    });

    const PAID = Object.freeze({ ...ORDER_ROW, state: "paid", payment_intent_id: INTENT });
    const charge = (type, object) => ({ id: "evt_test2", type, account: ACCOUNT, data: { object: { payment_intent: INTENT, ...object } } });

    it("revokes on a full refund and leaves a partial refund to the people involved", () => {
      assert.equal(decide(charge("charge.refunded", { refunded: true }), PAID).action, "refund");
      assert.equal(decide(charge("charge.refunded", { refunded: false }), PAID).code, "partial_refund");
      assert.equal(decide(charge("charge.refunded", {}), PAID).action, "ignore");
    });

    it("suspends on a dispute, including after a refund", () => {
      assert.equal(decide(charge("charge.dispute.created", {}), PAID).action, "dispute");
      assert.equal(decide(charge("charge.dispute.created", {}), { ...PAID, state: "refunded" }).action, "dispute");
      assert.equal(decide(charge("charge.dispute.created", {}), { ...PAID, state: "pending" }).action, "ignore");
    });

    it("ignores a refund or dispute on another payment, or on an order that never recorded one", () => {
      assert.equal(decide(charge("charge.refunded", { refunded: true, payment_intent: "pi_someoneelse1" }), PAID).code, "intent_mismatch");
      assert.equal(decide(charge("charge.refunded", { refunded: true }), { ...PAID, payment_intent_id: null }).code, "intent_mismatch");
    });

    it("has no order to act on when none was found", () => {
      assert.equal(decide(sessionEvent("checkout.session.completed"), null).code, "no_order");
    });
  });

  describe("who may download", () => {
    const PAID = Object.freeze({ ...ORDER_ROW, state: "paid" });
    const GRANT = Object.freeze({ order_id: ORDER, organization_id: SELLER, buyer_user_id: BUYER, version_id: VERSION, licence: ORDER_ROW.licence, revoked_at: null });
    const may = (overrides) => orders.downloadDecision({ order: PAID, grant: GRANT, userId: BUYER, ...overrides });

    it("lets the buyer download a paid, granted order for two minutes", () => {
      assert.deepEqual({ ...may() }, { ok: true, seconds: 120 });
    });

    it("answers somebody else exactly as it answers an order that does not exist", () => {
      assert.deepEqual({ ...may({ userId: STRANGER }) }, { ...may({ order: null }) });
      assert.equal(may({ userId: STRANGER }).status, 404);
    });

    it("unlocks nothing before Stripe confirms the payment", () => {
      for (const state of ["pending", "processing"]) assert.equal(may({ order: { ...PAID, state } }).code, "pending");
    });

    it("refuses closed and unknown orders even with a stale unrevoked grant", () => {
      for (const state of ["refunded", "disputed", "expired", "payment_failed", "unknown"]) {
        const answer = may({ order: { ...PAID, state } });
        assert.equal(answer.ok, false, state);
        assert.equal(answer.status, 410, state);
      }
    });

    it("needs the buyer's own grant on this order", () => {
      assert.equal(may({ grant: null }).code, "no_grant");
      assert.equal(may({ grant: { ...GRANT, order_id: STRANGER } }).code, "no_grant");
      assert.equal(may({ grant: { ...GRANT, buyer_user_id: STRANGER } }).code, "no_grant");
    });

    it("ends with a refund and is suspended by a dispute", () => {
      assert.match(may({ grant: { ...GRANT, revoked_at: "2026-10-06T00:00:00Z", revoked_reason: "refunded" } }).sentence, /refunded/);
      const disputed = may({ grant: { ...GRANT, revoked_at: "2026-10-06T00:00:00Z", revoked_reason: "disputed" } });
      assert.equal(disputed.status, 410);
      assert.match(disputed.sentence, /disputed/);
    });

    it("never authorizes a different workspace, version or licence", () => {
      for (const changed of [{ organization_id: STRANGER }, { version_id: STRANGER }, { licence: "exclusive_transfer" }, { version_id: undefined }]) {
        const result = may({ grant: { ...GRANT, ...changed } });
        assert.equal(result.ok, false);
        assert.equal(result.code, "grant_mismatch");
        assert.equal(result.status, 409);
      }
    });

    it("does not promise a licence from the payment state alone", () => {
      assert.doesNotMatch(orders.orderSentence(PAID), /licence is granted/);
    });
  });

  describe("the states the code knows are the states the database allows", () => {
    const sql = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "20261005010000_a_sale_is_a_licence_delivered.sql"), "utf8");
    const allowed = (sql.match(/state in \(([^)]*)\)\),\s*\n\s*expires_at/) || [])[1];

    it("reads the check constraint rather than nothing", () => {
      assert.ok(allowed, "could not find the state check in the migration; this check has gone blind");
    });

    it("matches ORDER_STATES exactly, and says something true for each", () => {
      const fromSql = allowed.split(",").map((value) => value.trim().replace(/'/g, ""));
      assert.deepEqual(fromSql, [...orders.ORDER_STATES]);
      for (const state of orders.ORDER_STATES) {
        assert.doesNotMatch(orders.orderSentence({ state }), /cannot tell/, `${state} has no sentence for the buyer`);
      }
    });
  });

  describe("opening Stripe's checkout", () => {
    const ENV = Object.freeze({
      SONARA_CUSTOMER_FUNDS_MODE: "connect_direct_reviewed", STRIPE_CONNECT_ENABLED: "true",
      STRIPE_SECRET_KEY: "sk_test_local_fixture_not_a_secret",
      STRIPE_CONNECT_WEBHOOK_SECRET: "whsec_localfixture0123456789"
    });
    const deps = (overrides = {}) => ({ getEnv: (name) => ({ ...ENV, ...overrides })[name] || "" });

    it("refuses to open a checkout nothing could fulfil", () => {
      assert.equal(checkout.checkoutReadiness(deps()).ok, true);
      for (const overrides of [
        { STRIPE_CONNECT_ENABLED: "" },
        { STRIPE_SECRET_KEY: "" },
        { STRIPE_CONNECT_WEBHOOK_SECRET: "" },
        { STRIPE_CONNECT_WEBHOOK_SECRET: "whsec_short" },
        { STRIPE_CONNECT_WEBHOOK_SECRET: "not_a_whsec_value_at_all" }
      ]) {
        assert.equal(checkout.checkoutReadiness(deps(overrides)).ok, false, JSON.stringify(overrides));
      }
    });

    function stripe(answer, status = 200) {
      const calls = [];
      const fetchImpl = async (url, init) => {
        calls.push({ url, init });
        if (answer instanceof Error) throw answer;
        return { ok: status >= 200 && status < 300, status, json: async () => answer };
      };
      return { calls, fetchImpl };
    }
    const good = { id: "cs_test_abcdef12", url: "https://checkout.stripe.com/c/pay/cs_test_abcdef12" };
    const open = (fetchImpl, overrides = {}) => checkout.createSession(deps(), { accountId: ACCOUNT, orderId: ORDER, fields: { mode: "payment" }, ...overrides }, fetchImpl);

    it("charges on the seller's account, keyed on the order", async () => {
      const { calls, fetchImpl } = stripe(good);
      const session = await open(fetchImpl);
      assert.deepEqual(session, { ok: true, ...good });
      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, "https://api.stripe.com/v1/checkout/sessions");
      assert.equal(calls[0].init.method, "POST");
      assert.equal(calls[0].init.headers["Stripe-Account"], ACCOUNT, "without Stripe-Account this is a platform charge, not the seller's");
      assert.equal(calls[0].init.headers["Idempotency-Key"], `sonara-marketplace-order-${ORDER}`);
      assert.ok(calls[0].init.signal, "no deadline on the call");
    });

    it("calls Stripe for no account it cannot name", async () => {
      const { calls, fetchImpl } = stripe(good);
      for (const accountId of ["", "acct_", "cus_123456789", undefined]) {
        assert.equal((await open(fetchImpl, { accountId })).ok, false);
      }
      assert.equal(calls.length, 0);
    });

    it("treats an error, a refusal or a session it cannot use as no checkout", async () => {
      for (const [answer, status] of [
        [new Error("offline"), 200],
        [{ error: { message: "account detail" } }, 400],
        [{ id: "cs_test_abcdef12" }, 200],
        [{ id: "not-a-session", url: good.url }, 200],
        [{ id: good.id, url: "https://checkout.stripe.com.evil.test/x" }, 200],
        [{ id: good.id, url: "http://checkout.stripe.com/c/pay" }, 200]
      ]) {
        const session = await open(stripe(answer, status).fetchImpl);
        assert.equal(session.ok, false, JSON.stringify(answer));
        assert.ok(!JSON.stringify(session).includes("account detail"), "Stripe's error body reached the caller");
      }
    });
  });
});
