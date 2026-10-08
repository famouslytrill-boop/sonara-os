"use strict";

// A dispute revokes a marketplace licence, and takes a shop order out of money
// received, the moment it opens. Nothing handled how it ended. When the seller
// won -- the money stayed with them -- the buyer stayed locked out of something
// they had paid for, and the shop's order stayed "disputed", for good.
//
// The end-to-end cases are in buying-a-licence-end-to-end and
// a-storefront-order-is-paid-on-the-shops-account. This file holds the decision
// and the thing that let the gap exist: the list of events the Connect webhook
// must be subscribed to was written nowhere, so an event nobody handled was
// also an event nobody asked Stripe to send.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { CONNECT_WEBHOOK_EVENTS } = require("../lib/sonara-connected-checkout.cjs");
const orders = require("../lib/sonara-marketplace-orders.cjs");

const root = path.join(__dirname, "..");
const INTENT = "pi_test12345678";
const DISPUTED = Object.freeze({ id: "11111111-1111-4111-8111-111111111111", state: "disputed", payment_intent_id: INTENT, stripe_account_id: "acct_test12345678" });
const closed = (status, extra = {}) => ({ id: "evt_closed1", type: "charge.dispute.closed", account: "acct_test12345678", data: { object: { payment_intent: INTENT, status, ...extra } } });

const DISPATCH = [
  "lib/sonara-marketplace-orders.cjs",
  "lib/sonara-merchant-payments.cjs",
  "routes/sonara-marketplace-checkout-routes.cjs"
];

function eventTypesNamedIn(file) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  return new Set([...source.matchAll(/["'`]((?:checkout\.session|charge)\.[a-z_]+(?:\.[a-z_]+)?)["'`]/g)].map((match) => match[1]));
}

describe("a dispute the seller wins gives the sale back", () => {
  describe("the marketplace decision", () => {
    it("reinstates only a disputed order whose payment stood", () => {
      assert.equal(orders.fulfilmentDecision({ event: closed("won"), order: DISPUTED }).action, "reinstate");
      assert.equal(orders.fulfilmentDecision({ event: closed("warning_closed"), order: DISPUTED }).action, "reinstate");
      assert.equal(orders.fulfilmentDecision({ event: closed("lost"), order: DISPUTED }).code, "dispute_lost");
      assert.equal(orders.fulfilmentDecision({ event: closed("under_review"), order: DISPUTED }).code, "dispute_status_unknown");
      assert.equal(orders.fulfilmentDecision({ event: closed("won"), order: { ...DISPUTED, state: "paid" } }).code, "not_disputed");
      assert.equal(orders.fulfilmentDecision({ event: closed("won", { payment_intent: "pi_otherpayment1" }), order: DISPUTED }).code, "intent_mismatch");
    });
  });

  describe("the events the Connect webhook must receive", () => {
    it("lists every event a sale decision handles, and nothing they do not", () => {
      assert.ok(CONNECT_WEBHOOK_EVENTS.length >= 5, `only ${CONNECT_WEBHOOK_EVENTS.length} events listed; this check has gone blind`);
      const named = new Set();
      for (const file of DISPATCH) for (const type of eventTypesNamedIn(file)) named.add(type);
      assert.ok(named.size >= 5, `only ${named.size} event types found in the dispatchers; the scan has stopped matching`);
      const unlisted = [...named].filter((type) => !CONNECT_WEBHOOK_EVENTS.includes(type));
      assert.deepEqual(unlisted, [], `handled but never subscribed to, so Stripe will not send them: ${unlisted.join(", ")}`);
      const unhandled = CONNECT_WEBHOOK_EVENTS.filter((type) => !named.has(type));
      assert.deepEqual(unhandled, [], `subscribed to but handled nowhere: ${unhandled.join(", ")}`);
    });

    it("tells the owner to subscribe to each of them", () => {
      const steps = fs.readFileSync(path.join(root, "docs", "owner", "OWNER-STEPS.md"), "utf8");
      const section = steps.slice(steps.indexOf("### The Connect webhook, and the events it must receive"));
      assert.ok(section.length > 100, "docs/owner/OWNER-STEPS.md no longer has the Connect webhook section");
      const missing = CONNECT_WEBHOOK_EVENTS.filter((type) => !section.includes("`" + type + "`"));
      assert.deepEqual(missing, [], `the owner is not told to subscribe to: ${missing.join(", ")}`);
      assert.match(section, /\/api\/webhooks\/stripe-connect/);
    });
  });
});
