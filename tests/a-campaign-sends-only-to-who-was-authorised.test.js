"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  dispatchCampaign,
  RESEND_ENDPOINT,
  RESEND_BATCH_ENDPOINT,
  MAX_PER_REQUEST,
  MAX_FALLBACK_BATCHES
} = require("../lib/growth-studio-dispatch.cjs");
const { authoriseCampaign, MINIMUM_BILLABLE_EMAILS } = require("../lib/growth-studio-sender.cjs");
const { quote } = require("../lib/sonara-paid-capabilities.cjs");
const { UNSUBSCRIBE_PATH, deriveSigningKey, verifyToken } = require("../lib/growth-studio-unsubscribe.cjs");

// The dispatcher is separate from the decision so the decision's refusals can be
// tested without a mail server. That split is only worth something if the
// dispatcher cannot reach a recipient the decision refused -- so the first
// assertions here are about exactly that.
//
// A page that asked the gate and then did the work regardless of the answer is
// what lib/sonara-agent-runner.cjs was written to replace. This is the same
// shape one product along.
const CONSENTED = Object.freeze({ channel: "email", consent_status: "granted" });
const APPROVED = Object.freeze({ status: "approved", approved_by: "owner-1" });
// SUPABASE_SERVICE_ROLE_KEY is here because the unsubscribe signing key is
// derived from it when SONARA_UNSUBSCRIBE_SECRET is unset, and dispatchCampaign
// refuses to send a campaign it cannot supply a way out of. Without it every
// test in this file refuses -- which is the guard working, and is why it is
// stated here rather than quietly added.
const ENV = {
  RESEND_API_KEY: "re_test",
  RESEND_FROM_EMAIL: "hello@example.com",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key-for-signing"
};
const ORIGIN = "https://app.example.com";
const READY = () => ({ services: { emailDelivery: "enabled" } });
const ledger = (rows) => ({ ok: true, rows });

// Records the wire calls AND flattens them into individual messages.
//
// The dispatcher sends up to MAX_PER_REQUEST recipients per request, so one
// call can carry a hundred messages. Assertions about what a RECIPIENT
// received read `calls.messages`; assertions about batching read `calls.wire`.
// Keeping both is the point: a helper that only flattened would let the
// batching itself go unasserted.
function okFetch(calls) {
  return async (url, options) => {
    const body = JSON.parse(options.body);
    const batch = Array.isArray(body) ? body : [body];
    calls.wire.push({ url: String(url), size: batch.length });
    for (const message of batch) calls.messages.push({ url: String(url), body: message });
    // A batch call must answer with one id per email or the dispatcher falls
    // back, so the stub answers the way a clean batch does.
    return { ok: true, status: 200, json: async () => ({ data: batch.map((unused, index) => ({ id: `id-${index}` })) }) };
  };
}

const recorder = () => ({ wire: [], messages: [] });

let nextLeadId = 0;
// A lead id is filled in when a case does not name one, because the unsubscribe
// token is signed per recipient and needs one. The route always supplies it --
// it selects `id` from growth_leads -- so a fixture without one would be
// testing a shape the product never produces. The one case that deliberately
// omits it asserts the refusal instead.
function authorised(recipients) {
  return authoriseCampaign({
    approval: APPROVED,
    recipients: recipients.map((recipient) =>
      // Genuinely distinct ids. This was `${nextLeadId++ % 10}` in one digit
      // with a fixed suffix, so it repeated every ten recipients -- and since
      // the unsubscribe token is derived from the lead id, twenty recipients
      // shared ten tokens. The batching test asking for twenty distinct tokens
      // found it. Lead ids are unique in the database, so a fixture that
      // repeats them is testing a shape the product never produces.
      "id" in recipient
        ? recipient
        : { ...recipient, id: `44444444-4444-4444-8444-${String(nextLeadId++).padStart(12, "0")}` }),
    history: ledger([{ entry_kind: "grant", amount_minor: 1000000 }]),
  });
}

const SEND = {
  subject: "A subject",
  body: "A body long enough to be real.",
  organizationId: "11111111-1111-4111-8111-111111111111",
  campaignId: "camp-1",
  origin: ORIGIN,
  getEnv: (name) => ENV[name],
  getReadiness: READY,
};

describe("a campaign sends only to who was authorised", () => {
  it("sends to exactly the eligible recipients, never the original list", () => {
    // The property the whole split exists for.
    const recipients = [
      { email: "yes1@example.com", consent: CONSENTED },
      { email: "yes2@example.com", consent: CONSENTED },
      { email: "no1@example.com" },
      { email: "no2@example.com", consent: { channel: "email", consent_status: "withdrawn" } },
    ];
    const decision = authorised(recipients);
    assert.equal(decision.eligible.length, 2);

    const calls = recorder();
    return dispatchCampaign({ ...SEND, decision, appendLedger: async () => ({ ok: true }), fetchImpl: okFetch(calls) }).then((result) => {
      assert.equal(result.sent, 2);
      assert.deepEqual(
        calls.messages.map((call) => call.body.to[0]).sort(),
        ["yes1@example.com", "yes2@example.com"],
        "a recipient the consent check refused must be unreachable from here"
      );
      // Two recipients go in one batch request now, so the endpoint asserted is
      // the batch one. That the batching happened at all is asserted below.
      for (const call of calls.wire) assert.equal(call.url, RESEND_BATCH_ENDPOINT);
      assert.equal(calls.wire.length, 1, "two recipients should be one request, not two");
    });
  });

  it("cannot be handed a refusal and made to send anyway", async () => {
    // A caller that passes an unauthorised decision by mistake must not send.
    // Checking is cheaper than trusting every caller to have checked.
    const refused = authoriseCampaign({ approval: null, recipients: [{ email: "a@example.com", consent: CONSENTED }] });
    assert.equal(refused.allowed, false);

    const calls = recorder();
    const result = await dispatchCampaign({ ...SEND, decision: refused, appendLedger: async () => ({ ok: true }), fetchImpl: okFetch(calls) });
    assert.equal(result.ok, false);
    assert.equal(result.code, "not_authorised");
    assert.equal(calls.wire.length, 0, "not one request may be made on an unauthorised decision");
  });

  it("refuses a decision that says allowed:false while still carrying recipients", async () => {
    // This assertion exists because its absence was found by falsification.
    // The test above passes a refusal whose `eligible` is empty, so the
    // emptiness check catches it and the `allowed !== true` check is never
    // exercised -- deleting that check left every test green. That is defect
    // six in .claude/skills/checks-that-cannot-lie: a check too weak to catch
    // the bug it was written for.
    //
    // A refusal WITH recipients is the shape that matters: a caller that reads
    // `eligible` and ignores `allowed` would send to people the decision
    // refused.
    const calls = recorder();
    const result = await dispatchCampaign({
      ...SEND,
      decision: { allowed: false, code: "insufficient_credit", eligible: [{ email: "a@example.com" }] },
      appendLedger: async () => ({ ok: true }),
      fetchImpl: okFetch(calls)
    });

    assert.equal(result.ok, false, "allowed:false must refuse however many recipients are attached");
    assert.equal(result.code, "not_authorised");
    assert.equal(calls.wire.length, 0, "not one request may be made when the decision said no");
  });

  it("refuses a decision object somebody hand-built to look allowed but with no recipients", async () => {
    const calls = recorder();
    const result = await dispatchCampaign({
      ...SEND,
      decision: { allowed: true, eligible: [] },
      appendLedger: async () => ({ ok: true }),
      fetchImpl: okFetch(calls)
    });
    assert.equal(result.ok, false);
    assert.equal(calls.wire.length, 0);
  });

  it("sends nothing when email delivery is not configured", async () => {
    // AGENTS.md: email must be off or explicitly user-controlled by default.
    const decision = authorised([{ email: "a@example.com", consent: CONSENTED }]);
    const calls = recorder();

    for (const readiness of [() => ({ services: { emailDelivery: "setup_required" } }), () => ({ services: { emailDelivery: "invalid" } })]) {
      const result = await dispatchCampaign({ ...SEND, decision, getReadiness: readiness, appendLedger: async () => ({ ok: true }), fetchImpl: okFetch(calls) });
      assert.equal(result.ok, false);
      assert.equal(result.code, "email_not_configured");
    }
    assert.equal(calls.wire.length, 0, "nothing may be sent while delivery is unconfigured");
  });

  it("sends nothing without a credential, even when readiness says otherwise", async () => {
    // Two independent gates. Readiness is derived and could be wrong; the
    // absence of a key is a fact.
    const decision = authorised([{ email: "a@example.com", consent: CONSENTED }]);
    const calls = recorder();
    const result = await dispatchCampaign({
      ...SEND,
      decision,
      getEnv: () => undefined,
      appendLedger: async () => ({ ok: true }),
      fetchImpl: okFetch(calls)
    });
    assert.equal(result.code, "email_not_configured");
    assert.equal(calls.wire.length, 0);
  });

  it("refuses without an organization or a campaign id", async () => {
    const decision = authorised([{ email: "a@example.com", consent: CONSENTED }]);
    const calls = recorder();

    const noOrg = await dispatchCampaign({ ...SEND, organizationId: null, decision, appendLedger: async () => ({ ok: true }), fetchImpl: okFetch(calls) });
    assert.equal(noOrg.code, "no_organization");

    // Without a campaign id the idempotency key would differ per attempt, so a
    // retry would charge twice and the ledger's unique index would not catch it.
    const noCampaign = await dispatchCampaign({ ...SEND, campaignId: null, decision, appendLedger: async () => ({ ok: true }), fetchImpl: okFetch(calls) });
    assert.equal(noCampaign.code, "no_campaign_id");

    assert.equal(calls.wire.length, 0);
  });

  it("refuses an empty subject or body rather than sending a blank email", async () => {
    const decision = authorised([{ email: "a@example.com", consent: CONSENTED }]);
    const calls = recorder();
    for (const overrides of [{ subject: "" }, { body: "" }, { subject: "   " }, { body: "  " }]) {
      const result = await dispatchCampaign({ ...SEND, ...overrides, decision, appendLedger: async () => ({ ok: true }), fetchImpl: okFetch(calls) });
      assert.equal(result.code, "empty_message");
    }
    assert.equal(calls.wire.length, 0);
  });

  describe("when some of the sends fail", () => {
    it("counts and names the failures rather than reporting success", async () => {
      // An owner told "sent" when 40 bounced has been told something false.
      const decision = authorised([
        { email: "good@example.com", consent: CONSENTED },
        { email: "bad@example.com", consent: CONSENTED },
      ]);

      const fetchImpl = async (url, options) => {
        const to = JSON.parse(options.body).to[0];
        return to === "bad@example.com" ? { ok: false, status: 422 } : { ok: true, status: 200 };
      };

      const result = await dispatchCampaign({ ...SEND, decision, appendLedger: async () => ({ ok: true }), fetchImpl });
      assert.equal(result.code, "partly_sent");
      assert.equal(result.sent, 1);
      assert.equal(result.failed.length, 1);
      assert.equal(result.failed[0].email, "bad@example.com", "the owner needs to know WHO did not receive it");
      assert.equal(result.failed[0].status, 422, "a 422 and a 429 need different actions");
    });

    it("charges for what was accepted, not for what was attempted", async () => {
      // We pay Resend per accepted message. Billing for attempts would charge
      // the customer for our own failed requests.
      //
      // CORRECTED 10 September 2026. This test used three recipients with one
      // accepted and asserted `units === 1`, which encoded a real bug rather
      // than catching it: the sender authorises credit against
      // MINIMUM_BILLABLE_EMAILS and tells the customer "billed at the 10-email
      // minimum", while the draw here used the raw accepted count. Both numbers
      // sat below the minimum, so the test could not see the disagreement, and
      // the charge went out at exactly the zero margin the minimum exists to
      // prevent.
      //
      // Twenty-four recipients with four rejected puts BOTH counts clear of the
      // minimum, so the assertion actually distinguishes accepted from
      // attempted instead of collapsing them onto the floor.
      const addresses = Array.from({ length: 24 }, (unused, index) => `bulk${index}@example.com`);
      const rejected = new Set(["bulk0@example.com", "bulk3@example.com", "bulk7@example.com", "bulk9@example.com"]);
      const decision = authorised(addresses.map((email) => ({ email, consent: CONSENTED })));

      const rows = [];
      const fetchImpl = async (url, options) =>
        (rejected.has(JSON.parse(options.body).to[0]) ? { ok: false, status: 500 } : { ok: true, status: 200 });

      const result = await dispatchCampaign({
        ...SEND,
        decision,
        appendLedger: async (row) => {
          rows.push(row);
          return { ok: true };
        },
        fetchImpl
      });

      assert.equal(result.sent, 20);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].units, 20, "twenty-four attempted, twenty accepted, twenty charged");
      assert.equal(rows[0].amount_minor, quote("campaign_email", 20).chargeMinor);
      assert.notEqual(rows[0].amount_minor, quote("campaign_email", 24).chargeMinor, "billing the attempts would charge for our own failures");
    });

    it("bills a small campaign at the minimum the sender authorised, not at the raw count", async () => {
      // The other half of the same correction, asserted on purpose. Below ten
      // recipients the two numbers separate: the sender reserves credit for ten
      // and says so, and the draw has to agree with the sentence the customer
      // was shown.
      const decision = authorised([{ email: "a@example.com", consent: CONSENTED }]);
      const rows = [];
      const result = await dispatchCampaign({
        ...SEND,
        decision,
        appendLedger: async (row) => {
          rows.push(row);
          return { ok: true };
        },
        fetchImpl: async () => ({ ok: true, status: 200 })
      });

      assert.equal(result.sent, 1);
      assert.equal(rows[0].units, MINIMUM_BILLABLE_EMAILS);
      assert.ok(
        quote("campaign_email", MINIMUM_BILLABLE_EMAILS).marginMinor > 0,
        "the minimum has to actually produce margin, or it is a rule with no purpose"
      );
      assert.equal(quote("campaign_email", 1).marginMinor, 0, "and one email at the raw count is the zero-margin case it prevents");
    });

    it("charges nothing when every send failed", async () => {
      const decision = authorised([{ email: "a@example.com", consent: CONSENTED }]);
      const rows = [];
      const result = await dispatchCampaign({
        ...SEND,
        decision,
        appendLedger: async (row) => {
          rows.push(row);
          return { ok: true };
        },
        fetchImpl: async () => ({ ok: false, status: 500 })
      });

      assert.equal(result.ok, false);
      assert.equal(result.code, "all_failed");
      assert.equal(rows.length, 0, "nothing was delivered, so nothing may be charged");
    });

    it("treats a thrown request as a failure, not as a success", async () => {
      const decision = authorised([{ email: "a@example.com", consent: CONSENTED }]);
      const result = await dispatchCampaign({
        ...SEND,
        decision,
        appendLedger: async () => ({ ok: true }),
        fetchImpl: async () => {
          throw new Error("connection reset");
        }
      });
      assert.equal(result.sent, 0);
      assert.equal(result.failed.length, 1);
    });
  });


  // A campaign nobody can stop is the one refusal here that is not about cost
  // or consent, and it fails closed. The alternative cannot be taken back: the
  // mail is in somebody's inbox with no way to stop the next one, and this
  // product's own /legal/can-spam page told the owner a working unsubscribe was
  // one of the basics.
  describe("every campaign carries a way to stop it", () => {
    it("puts both RFC 8058 headers on every message", async () => {
      const calls = recorder();
      await dispatchCampaign({
        ...SEND,
        decision: authorised([{ email: "a@example.com", consent: CONSENTED }]),
        appendLedger: async () => ({ ok: true }),
        fetchImpl: okFetch(calls)
      });

      assert.equal(calls.messages.length, 1);
      const headers = calls.messages[0].body.headers;
      assert.ok(headers, "no custom headers were sent, so no mail client can offer one-click unsubscribe");
      // RFC 8058: the List-Unsubscribe field MUST contain one HTTPS URI, and
      // List-Unsubscribe-Post MUST contain exactly this pair.
      assert.equal(headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
      assert.match(headers["List-Unsubscribe"], /^<https:\/\/[^>]+>$/, "the URI must be https and angle-bracketed");
      assert.ok(headers["List-Unsubscribe"].includes(UNSUBSCRIBE_PATH));
    });

    it("also puts a link in the body, for clients that ignore the headers", async () => {
      const calls = recorder();
      await dispatchCampaign({
        ...SEND,
        decision: authorised([{ email: "a@example.com", consent: CONSENTED }]),
        appendLedger: async () => ({ ok: true }),
        fetchImpl: okFetch(calls)
      });
      assert.match(calls.messages[0].body.text, /To stop receiving these emails/);
      assert.match(calls.messages[0].body.text, new RegExp(UNSUBSCRIBE_PATH.replace("/", "\\/")));
      assert.match(calls.messages[0].body.text, /A body long enough to be real\./, "the owner's own message must survive");
    });

    it("signs a different token for each recipient", async () => {
      // One shared link would let any recipient unsubscribe every other, and
      // would make a forwarded email a way to remove somebody else.
      const calls = recorder();
      await dispatchCampaign({
        ...SEND,
        decision: authorised([
          { email: "a@example.com", consent: CONSENTED },
          { email: "b@example.com", consent: CONSENTED }
        ]),
        appendLedger: async () => ({ ok: true }),
        fetchImpl: okFetch(calls)
      });

      const tokens = calls.messages.map((call) => new URL(call.body.headers["List-Unsubscribe"].slice(1, -1)).searchParams.get("t"));
      assert.equal(tokens.length, 2);
      assert.notEqual(tokens[0], tokens[1], "two recipients must not share an unsubscribe token");
      for (const token of tokens) {
        assert.equal(verifyToken(token, deriveSigningKey((name) => ENV[name])).ok, true, "our own token must verify");
      }
    });

    it("issues a token that names the organization it was sent for", async () => {
      const calls = recorder();
      await dispatchCampaign({
        ...SEND,
        decision: authorised([{ email: "a@example.com", consent: CONSENTED }]),
        appendLedger: async () => ({ ok: true }),
        fetchImpl: okFetch(calls)
      });
      const token = new URL(calls.messages[0].body.headers["List-Unsubscribe"].slice(1, -1)).searchParams.get("t");
      const verified = verifyToken(token, deriveSigningKey((name) => ENV[name]));
      assert.equal(verified.organizationId, SEND.organizationId, "the withdrawal it authorises is organization-scoped");
      assert.equal(verified.channel, "email");
    });

    it("sends nothing at all when there is no signing key", async () => {
      const calls = recorder();
      const result = await dispatchCampaign({
        ...SEND,
        getEnv: (name) => ({ RESEND_API_KEY: "re_test", RESEND_FROM_EMAIL: "hello@example.com" })[name],
        decision: authorised([{ email: "a@example.com", consent: CONSENTED }]),
        appendLedger: async () => ({ ok: true }),
        fetchImpl: okFetch(calls)
      });
      assert.equal(result.ok, false);
      assert.equal(result.code, "unsubscribe_not_configured");
      assert.deepEqual(calls.messages, [], "sending without a way out is the one thing that cannot be undone");
    });

    it("sends nothing when this site's https address is unknown", async () => {
      for (const origin of ["", null, undefined, "http://app.example.com"]) {
        const calls = recorder();
        const result = await dispatchCampaign({
          ...SEND,
          origin,
          decision: authorised([{ email: "a@example.com", consent: CONSENTED }]),
          appendLedger: async () => ({ ok: true }),
          fetchImpl: okFetch(calls)
        });
        assert.equal(result.ok, false, `an origin of ${JSON.stringify(origin)} must not produce a send`);
        assert.equal(result.code, "unsubscribe_origin_required");
        assert.deepEqual(calls.messages, [], "an http unsubscribe link is a downgrade RFC 8058 forbids, not a fallback");
      }
    });

    it("does not email a recipient it cannot give a link to, and names why", async () => {
      const calls = recorder();
      const result = await dispatchCampaign({
        ...SEND,
        decision: authorised([
          { email: "a@example.com", consent: CONSENTED, id: null },
          { email: "b@example.com", consent: CONSENTED }
        ]),
        appendLedger: async () => ({ ok: true }),
        fetchImpl: okFetch(calls)
      });

      assert.equal(result.sent, 1);
      assert.deepEqual(calls.messages.map((call) => call.body.to[0]), ["b@example.com"]);
      assert.equal(result.failed.length, 1);
      assert.equal(result.failed[0].email, "a@example.com");
      assert.equal(result.failed[0].reason, "no_unsubscribe_link", "counted and named, never skipped quietly");
    });

    it("charges only for what it actually emailed", async () => {
      // The recipient with no link was never emailed, so billing for them would
      // charge for a send that did not happen.
      const rows = [];
      const ids = Array.from({ length: 24 }, (unused, index) => `4444444${index % 10}-4444-4444-8444-4444444444${String(index).padStart(2, "0")}`);
      const result = await dispatchCampaign({
        ...SEND,
        decision: authorised(ids.map((id, index) => ({ email: `bulk${index}@example.com`, consent: CONSENTED, id: index < 4 ? null : id }))),
        appendLedger: async (row) => {
          rows.push(row);
          return { ok: true };
        },
        fetchImpl: okFetch(recorder())
      });

      assert.equal(result.sent, 20);
      assert.equal(rows[0].units, 20);
      assert.notEqual(rows[0].amount_minor, quote("campaign_email", 24).chargeMinor);
    });
  });


  // Batching raised the reach from 400 to 1,000, and the only reason it is safe
  // is the fallback. Resend documents that a clean batch response is
  // index-aligned -- "each entry in `data` corresponds to the email at the same
  // index in the batch payload (0-based)" -- and documents **nothing** about
  // partial failure. So a batch is trusted only when it returns one id per
  // email, and anything else is resent one at a time rather than interpreted.
  describe("many recipients in one request, and what happens when that goes wrong", () => {
    const many = (count) =>
      authorised(Array.from({ length: count }, (unused, index) => ({ email: `bulk${index}@example.com`, consent: CONSENTED })));

    it("puts up to the documented ceiling in one request", async () => {
      const calls = recorder();
      const result = await dispatchCampaign({
        ...SEND,
        decision: many(MAX_PER_REQUEST),
        appendLedger: async () => ({ ok: true }),
        fetchImpl: okFetch(calls)
      });

      assert.equal(result.sent, MAX_PER_REQUEST);
      assert.equal(calls.wire.length, 1, `${MAX_PER_REQUEST} recipients should be one request`);
      assert.equal(calls.wire[0].url, RESEND_BATCH_ENDPOINT);
      assert.equal(calls.messages.length, MAX_PER_REQUEST, "every recipient still gets their own message");
      assert.ok(MAX_PER_REQUEST <= 100, "the reference documents up to 100 per batch; more would be rejected");
    });

    it("splits past the ceiling rather than sending an over-long batch", async () => {
      const calls = recorder();
      const result = await dispatchCampaign({
        ...SEND,
        decision: many(MAX_PER_REQUEST + 5),
        appendLedger: async () => ({ ok: true }),
        fetchImpl: okFetch(calls)
      });

      assert.equal(result.sent, MAX_PER_REQUEST + 5);
      assert.equal(calls.wire.length, 2);
      assert.deepEqual(calls.wire.map((call) => call.size), [MAX_PER_REQUEST, 5]);
      for (const call of calls.wire) assert.ok(call.size <= MAX_PER_REQUEST, "no request may exceed the documented ceiling");
    });

    it("still gives every recipient their own unsubscribe token inside a batch", async () => {
      // The property batching most easily breaks: one shared link would let any
      // recipient unsubscribe every other.
      const calls = recorder();
      await dispatchCampaign({ ...SEND, decision: many(20), appendLedger: async () => ({ ok: true }), fetchImpl: okFetch(calls) });

      const tokens = calls.messages.map((call) => new URL(call.body.headers["List-Unsubscribe"].slice(1, -1)).searchParams.get("t"));
      assert.equal(tokens.length, 20);
      assert.equal(new Set(tokens).size, 20, "twenty recipients in one request must still have twenty distinct tokens");
      for (const token of tokens) {
        assert.equal(verifyToken(token, deriveSigningKey((name) => ENV[name])).ok, true);
      }
    });

    it("sends a lone recipient individually rather than as a batch of one", async () => {
      const calls = recorder();
      await dispatchCampaign({
        ...SEND,
        decision: authorised([{ email: "a@example.com", consent: CONSENTED }]),
        appendLedger: async () => ({ ok: true }),
        fetchImpl: okFetch(calls)
      });
      assert.equal(calls.wire[0].url, RESEND_ENDPOINT, "one recipient needs no reconciliation, so it should not go through the code that reconciles");
    });

    it("resends the batch one at a time when it does not return an id per email", async () => {
      // The undocumented case. Rather than interpret a short `data`, the batch
      // is resent individually so every outcome is attributed to an address.
      const calls = recorder();
      let batches = 0;
      const result = await dispatchCampaign({
        ...SEND,
        decision: many(3),
        appendLedger: async () => ({ ok: true }),
        report: () => {},
        fetchImpl: async (url, options) => {
          const body = JSON.parse(options.body);
          if (String(url) === RESEND_BATCH_ENDPOINT) {
            batches += 1;
            calls.wire.push({ url: String(url), size: body.length });
            // Two ids for three emails: the shape that cannot be reconciled.
            return { ok: true, status: 200, json: async () => ({ data: [{ id: "a" }, { id: "b" }] }) };
          }
          calls.messages.push({ url: String(url), body });
          return { ok: true, status: 200 };
        }
      });

      assert.equal(batches, 1);
      assert.equal(result.sent, 3, "all three still land, by the individual path");
      assert.deepEqual(
        calls.messages.map((call) => call.body.to[0]).sort(),
        ["bulk0@example.com", "bulk1@example.com", "bulk2@example.com"],
        "each recipient must be retried by name"
      );
    });

    it("attributes each failure by address after a fallback", async () => {
      const calls = recorder();
      const result = await dispatchCampaign({
        ...SEND,
        decision: many(3),
        appendLedger: async () => ({ ok: true }),
        report: () => {},
        fetchImpl: async (url, options) => {
          const body = JSON.parse(options.body);
          if (String(url) === RESEND_BATCH_ENDPOINT) return { ok: false, status: 500 };
          if (body.to[0] === "bulk1@example.com") return { ok: false, status: 422 };
          calls.messages.push({ body });
          return { ok: true, status: 200 };
        }
      });

      assert.equal(result.sent, 2);
      assert.deepEqual(result.failed, [{ email: "bulk1@example.com", status: 422 }], "the whole point of falling back is that this names an address");
    });

    it("reports what it did not attempt once the fallback budget is spent", async () => {
      // The fallback is what could run the function out of time, so it is
      // bounded -- and past the bound the remaining recipients are reported as
      // NOT ATTEMPTED rather than attempted and untracked.
      const total = MAX_PER_REQUEST * (MAX_FALLBACK_BATCHES + 1);
      let individual = 0;
      const result = await dispatchCampaign({
        ...SEND,
        decision: many(total),
        appendLedger: async () => ({ ok: true }),
        report: () => {},
        fetchImpl: async (url) => {
          if (String(url) === RESEND_BATCH_ENDPOINT) return { ok: false, status: 500 };
          individual += 1;
          return { ok: true, status: 200 };
        }
      });

      assert.equal(individual, MAX_PER_REQUEST * MAX_FALLBACK_BATCHES, "exactly the permitted number of batches may fall back");
      assert.equal(result.sent, MAX_PER_REQUEST * MAX_FALLBACK_BATCHES);
      assert.equal(result.notAttempted.length, MAX_PER_REQUEST, "the rest must be reported, not silently dropped");
      assert.equal(result.notAttempted[0].reason, "fallback_budget_spent");
      assert.equal(result.code, "partly_sent", "a campaign with unattempted recipients is not 'sent'");
      assert.match(result.detail, /not attempted/, "the owner has to be told to send again");
    });

    it("tells 'not attempted' apart from 'failed'", async () => {
      // One was tried and refused; the other was never tried. An owner does
      // something different about each, so collapsing them loses the action.
      const total = MAX_PER_REQUEST * (MAX_FALLBACK_BATCHES + 1);
      const result = await dispatchCampaign({
        ...SEND,
        decision: many(total),
        appendLedger: async () => ({ ok: true }),
        report: () => {},
        fetchImpl: async (url, options) => {
          if (String(url) === RESEND_BATCH_ENDPOINT) return { ok: false, status: 500 };
          return { ok: JSON.parse(options.body).to[0] !== "bulk0@example.com", status: 422 };
        }
      });

      assert.equal(result.failed.length, 1, "one address was tried and refused");
      assert.equal(result.failed[0].email, "bulk0@example.com");
      assert.equal(result.notAttempted.length, MAX_PER_REQUEST, "and a hundred were never tried at all");
      assert.ok(!result.failed.some((entry) => entry.reason === "fallback_budget_spent"), "an unattempted recipient must not be reported as a failure");
    });

    it("charges only for what a fallback actually got out", async () => {
      const total = MAX_PER_REQUEST * (MAX_FALLBACK_BATCHES + 1);
      const rows = [];
      await dispatchCampaign({
        ...SEND,
        decision: many(total),
        appendLedger: async (row) => {
          rows.push(row);
          return { ok: true };
        },
        report: () => {},
        fetchImpl: async (url) => (String(url) === RESEND_BATCH_ENDPOINT ? { ok: false, status: 500 } : { ok: true, status: 200 })
      });

      assert.equal(rows[0].units, MAX_PER_REQUEST * MAX_FALLBACK_BATCHES, "billing the unattempted ones would charge for sends that never happened");
      assert.notEqual(rows[0].units, total);
    });

    it("says a batch fell back, rather than falling back quietly", async () => {
      const reported = [];
      await dispatchCampaign({
        ...SEND,
        decision: many(3),
        appendLedger: async () => ({ ok: true }),
        report: (entry) => reported.push(entry),
        fetchImpl: async (url) => (String(url) === RESEND_BATCH_ENDPOINT ? { ok: false, status: 503 } : { ok: true, status: 200 })
      });

      const fellBack = reported.find((entry) => entry.code === "batch_fell_back");
      assert.ok(fellBack, "a fallback nobody records is a duplicate-send risk nobody can explain later");
      assert.match(fellBack.detail, /503/, "the status is what says whether to expect it again");
    });
  });

  describe("when the ledger fails after the emails have gone", () => {
    it("does not report the campaign as unsent, because it was sent", async () => {
      // Nothing here can un-send an email. Failing the dispatch would tell the
      // owner nothing went out while the messages are already in flight.
      const decision = authorised([{ email: "a@example.com", consent: CONSENTED }]);
      const reported = [];
      const result = await dispatchCampaign({
        ...SEND,
        decision,
        appendLedger: async () => ({ ok: false, code: "ledger_write_failed" }),
        report: (details) => reported.push(details),
        fetchImpl: okFetch(recorder())
      });

      assert.equal(result.ok, true, "the email was delivered; the dispatch did not fail");
      assert.equal(result.sent, 1);
      assert.equal(result.charge.ok, false);
      assert.equal(reported.length, 1, "a charge that did not land must be reported, loudly");
      assert.match(reported[0].detail, /not recorded/);
    });

    it("tells an unwired ledger apart from a failing one", async () => {
      // A caller that forgot to wire it has a bug; a ledger that rejected the
      // row has an outage. Reporting both the same hides one of them.
      const decision = authorised([{ email: "a@example.com", consent: CONSENTED }]);
      const reported = [];
      const result = await dispatchCampaign({ ...SEND, decision, appendLedger: null, report: (d) => reported.push(d), fetchImpl: okFetch(recorder()) });

      assert.equal(result.charge.code, "ledger_not_wired");
      assert.equal(reported[0].code, "ledger_not_wired");
    });

    it("keys the charge on the campaign, so a retried dispatch cannot charge twice", async () => {
      const decision = authorised([{ email: "a@example.com", consent: CONSENTED }]);
      const rows = [];
      const send = async () =>
        dispatchCampaign({
          ...SEND,
          decision,
          appendLedger: async (row) => {
            rows.push(row);
            return { ok: true };
          },
          fetchImpl: okFetch(recorder())
        });

      await send();
      await send();
      assert.equal(rows.length, 2, "both attempts write");
      assert.equal(rows[0].idempotency_key, rows[1].idempotency_key, "the same key means the database rejects the second");
      assert.equal(rows[0].idempotency_key, "campaign:camp-1");
    });
  });

  it("does not print a recipient address or a key through the default reporter", () => {
    // The default reporter goes to a log. The route-error log leaked a
    // service-role key once and the rate limiters twice; the boundary exists
    // because of that, and this line goes through it.
    const source = fs.readFileSync(path.join(__dirname, "..", "lib", "growth-studio-dispatch.cjs"), "utf8");
    const reporter = source.slice(source.indexOf("function defaultReport("), source.indexOf("// Send an authorised campaign."));
    assert.ok(reporter.length > 40, "could not isolate the default reporter");
    assert.match(reporter, /redactSensitiveText/, "the default reporter must go through the redaction boundary");
  });
});
