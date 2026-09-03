"use strict";

// Stripe retries webhooks. It retries on any non-2xx, it retries on a timeout,
// and it can deliver the same event more than once even after a 200. So the
// question "what happens when this event arrives twice" is not hypothetical for
// a payment path -- it is the normal case.
//
// `tools/../python/sonara_ops/stripe_audit.py` asks it as a checklist item:
//
//     "Confirm stripe_events or billing_events stores processed event IDs
//      idempotently."
//
// **Neither table exists.** Not in any migration, not anywhere in `lib/`,
// `routes/` or `server.js`. Read literally, that item sends the next person
// hunting for two tables that were never the mechanism, and the honest answer
// looks like "no" when it is "yes, differently".
//
// What actually happens, traced through server.js:3526:
//
//   1. the signature is verified, and a bad one is a 400 before anything is read;
//   2. `recordBillingWebhookEvent` upserts into `billing_webhook_events` on
//      `(provider, provider_event_id)` with `resolution=ignore-duplicates`, so
//      the audit trail holds one row per Stripe event id however many times it
//      arrives;
//   3. `synchronizeBillingFromStripeEvent` then runs **unconditionally** -- the
//      duplicate is not used as a gate.
//
// Step 3 is safe, and this file is what says so rather than leaving it to be
// re-derived. Every write in that path is an upsert keyed on a natural
// identifier -- the subscription reference, the organization and entitlement
// key, the checkout session id -- with `resolution=merge-duplicates`. Replaying
// an event writes the same state to the same row. The idempotency is in the
// shape of the writes, not in an event-id check.
//
// That is a legitimate design and it is one edit from not being. Change any of
// those `on_conflict` upserts to a plain insert and a retried webhook starts
// duplicating subscription rows, silently, in the table the paid-access check
// reads. These assertions are on the requests the application actually sends.
//
// One thing this deliberately does **not** claim: that out-of-order delivery is
// handled. Stripe does not guarantee order, and `merge-duplicates` keyed on the
// subscription reference with no version column means an older
// `customer.subscription.updated` arriving late overwrites newer state. That is
// recorded in docs/SPRINT_LOG.md as an open question for the owner rather than
// asserted here as a defect, because nothing in this repository establishes how
// often it happens or what it would cost.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const SERVER = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
const BILLING = fs.readFileSync(path.join(__dirname, "..", "lib", "sonara-billing.cjs"), "utf8");
const AUDIT_RAW = fs.readFileSync(path.join(__dirname, "..", "python", "sonara_ops", "stripe_audit.py"), "utf8");
// Python comments stripped. The checklist *items* are what an operator reads;
// the commentary around them is for whoever edits the file. Asserting against
// the raw text let a comment satisfy the check -- the probe that renamed the
// item back to a table that does not exist stayed green, because the reasoning
// above it still mentioned the real one. The fourth loose pattern in this
// session, and the same shape every time.
const AUDIT = AUDIT_RAW.split("\n").map((line) => line.replace(/(^|\s)#.*$/, "$1")).join("\n");
const MIGRATIONS = path.join(__dirname, "..", "supabase", "migrations");

/** Source with comments stripped, so prose about a table is not read as code. */
function code(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

function everyMigration() {
  return fs.readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => fs.readFileSync(path.join(MIGRATIONS, name), "utf8"))
    .join("\n");
}

describe("a replayed Stripe event changes nothing twice", () => {
  describe("the harness is capable of failing", () => {
    it("read the files it is asserting about", () => {
      assert.ok(SERVER.length > 50000, "server.js came back too small; this check has gone blind");
      assert.ok(BILLING.includes("recordBillingWebhookEvent"), "the billing module no longer has the webhook recorder");
      assert.match(code(SERVER), /handleStripeWebhook/, "server.js no longer defines the webhook handler");
    });
  });

  describe("nothing is trusted before the signature is", () => {
    it("refuses an unsigned or wrongly signed payload before parsing it", () => {
      const handler = code(SERVER).slice(code(SERVER).indexOf("async function handleStripeWebhook"));
      const body = handler.slice(0, handler.indexOf("\n}\n"));
      const verifyAt = body.indexOf("verifyStripeWebhookSignature");
      const parseAt = body.indexOf("JSON.parse");
      assert.ok(verifyAt > 0, "the handler no longer verifies the signature");
      assert.ok(parseAt > 0, "the handler no longer parses the event");
      assert.ok(
        verifyAt < parseAt,
        "the payload is parsed before the signature is checked; an attacker's JSON would be read first"
      );
      assert.match(body, /invalid_signature/, "a bad signature no longer has its own refusal code");
    });
  });

  describe("the audit trail holds one row per event id", () => {
    it("upserts on the event id rather than inserting", () => {
      const recorder = BILLING.slice(BILLING.indexOf("async function recordBillingWebhookEvent"));
      const body = recorder.slice(0, recorder.indexOf("\n  }\n"));
      assert.match(
        body,
        /billing_webhook_events\?on_conflict=provider,provider_event_id/,
        "the webhook audit write is no longer keyed on the Stripe event id; a retry would add a second row"
      );
      assert.match(
        body,
        /resolution=ignore-duplicates/,
        "the audit write no longer ignores duplicates, so a retried event either errors or overwrites the first record of it"
      );
      assert.match(body, /provider_event_id: event\.id/, "the audit row no longer carries the Stripe event id");
    });

    it("writes to a table that exists", () => {
      // The whole reason this file exists: the audit checklist named two tables
      // that do not. This asserts the one actually used is real.
      assert.match(
        everyMigration(),
        /create table (?:if not exists )?public\.billing_webhook_events/,
        "billing_webhook_events is not created by any migration"
      );
    });
  });

  describe("replaying an event re-applies state rather than adding it", () => {
    const sync = BILLING.slice(BILLING.indexOf("async function synchronizeBillingFromStripeEvent"));
    const region = sync.slice(0, sync.indexOf("async function ") > 0 ? sync.indexOf("\n  async function ", 10) : sync.length);

    for (const [table, key] of [
      ["billing_subscriptions", "provider,provider_subscription_ref"],
      ["billing_entitlements", "organization_id,entitlement_key"]
    ]) {
      it(`upserts ${table} on ${key}`, () => {
        assert.ok(
          region.includes(`${table}?on_conflict=${key}`),
          `${table} is no longer upserted on ${key}. A retried webhook would insert a second row, and the ` +
            "paid-access check reads this table"
        );
      });
    }

    it("merges rather than ignoring, so a real state change is not dropped", () => {
      // ignore-duplicates is right for the audit trail, where the second copy
      // says nothing new. It would be wrong here: `customer.subscription.updated`
      // carries a status that must land.
      assert.match(region, /resolution=merge-duplicates/, "the subscription sync no longer merges on conflict");
      assert.doesNotMatch(
        region,
        /billing_subscriptions[^\n]*resolution=ignore-duplicates/,
        "the subscription sync ignores duplicates, so a status change on an existing subscription is dropped"
      );
    });

    it("keys a completed checkout on the session id", () => {
      const checkout = BILLING.slice(BILLING.indexOf("async function synchronizeCheckoutSessionCompleted"));
      assert.match(
        checkout.slice(0, 2000),
        /purchases\?on_conflict=stripe_checkout_session_id/,
        "a purchase is no longer keyed on the checkout session; a retried event would charge the record twice"
      );
    });

    it("ignores event types it does not handle instead of half-applying them", () => {
      assert.match(region, /ignored: true/, "an unhandled event type no longer returns a stated no-op");
    });
  });

  describe("the ops checklist names something real", () => {
    it("does not send somebody looking for a table that does not exist", () => {
      // The finding that produced this file. `stripe_events` and
      // `billing_events` appear in no migration and nowhere in the runtime.
      const migrations = everyMigration();
      for (const invented of ["stripe_events", "billing_events"]) {
        assert.ok(
          !new RegExp(`create table (?:if not exists )?public\\.${invented}\\b`).test(migrations),
          `${invented} now exists, so the checklist wording should be revisited rather than this test relaxed`
        );
      }
      assert.match(
        AUDIT,
        /billing_webhook_events/,
        "the Stripe audit checklist does not name billing_webhook_events, which is the table that actually " +
          "stores processed event ids"
      );
    });

    it("says what makes the replay safe, not just that ids are stored", () => {
      assert.match(
        AUDIT,
        /upsert|on_conflict|merge-duplicates/i,
        "the checklist does not mention the mechanism. Storing event ids is not what makes this safe -- the " +
          "sync runs on every delivery, and it is the upserts that make a second run a no-op"
      );
    });
  });
});
