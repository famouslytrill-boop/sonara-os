"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { dispatchCampaign, RESEND_ENDPOINT } = require("../lib/growth-studio-dispatch.cjs");
const { authoriseCampaign } = require("../lib/growth-studio-sender.cjs");
const { quote } = require("../lib/sonara-paid-capabilities.cjs");

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
const ENV = { RESEND_API_KEY: "re_test", RESEND_FROM_EMAIL: "hello@example.com" };
const READY = () => ({ services: { emailDelivery: "enabled" } });
const ledger = (rows) => ({ ok: true, rows });

function okFetch(calls) {
  return async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    return { ok: true, status: 200 };
  };
}

function authorised(recipients) {
  return authoriseCampaign({
    approval: APPROVED,
    recipients,
    history: ledger([{ entry_kind: "grant", amount_minor: 1000000 }]),
  });
}

const SEND = {
  subject: "A subject",
  body: "A body long enough to be real.",
  organizationId: "org-1",
  campaignId: "camp-1",
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

    const calls = [];
    return dispatchCampaign({ ...SEND, decision, appendLedger: async () => ({ ok: true }), fetchImpl: okFetch(calls) }).then((result) => {
      assert.equal(result.sent, 2);
      assert.deepEqual(
        calls.map((call) => call.body.to[0]).sort(),
        ["yes1@example.com", "yes2@example.com"],
        "a recipient the consent check refused must be unreachable from here"
      );
      for (const call of calls) assert.equal(call.url, RESEND_ENDPOINT);
    });
  });

  it("cannot be handed a refusal and made to send anyway", async () => {
    // A caller that passes an unauthorised decision by mistake must not send.
    // Checking is cheaper than trusting every caller to have checked.
    const refused = authoriseCampaign({ approval: null, recipients: [{ email: "a@example.com", consent: CONSENTED }] });
    assert.equal(refused.allowed, false);

    const calls = [];
    const result = await dispatchCampaign({ ...SEND, decision: refused, appendLedger: async () => ({ ok: true }), fetchImpl: okFetch(calls) });
    assert.equal(result.ok, false);
    assert.equal(result.code, "not_authorised");
    assert.equal(calls.length, 0, "not one request may be made on an unauthorised decision");
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
    const calls = [];
    const result = await dispatchCampaign({
      ...SEND,
      decision: { allowed: false, code: "insufficient_credit", eligible: [{ email: "a@example.com" }] },
      appendLedger: async () => ({ ok: true }),
      fetchImpl: okFetch(calls)
    });

    assert.equal(result.ok, false, "allowed:false must refuse however many recipients are attached");
    assert.equal(result.code, "not_authorised");
    assert.equal(calls.length, 0, "not one request may be made when the decision said no");
  });

  it("refuses a decision object somebody hand-built to look allowed but with no recipients", async () => {
    const calls = [];
    const result = await dispatchCampaign({
      ...SEND,
      decision: { allowed: true, eligible: [] },
      appendLedger: async () => ({ ok: true }),
      fetchImpl: okFetch(calls)
    });
    assert.equal(result.ok, false);
    assert.equal(calls.length, 0);
  });

  it("sends nothing when email delivery is not configured", async () => {
    // AGENTS.md: email must be off or explicitly user-controlled by default.
    const decision = authorised([{ email: "a@example.com", consent: CONSENTED }]);
    const calls = [];

    for (const readiness of [() => ({ services: { emailDelivery: "setup_required" } }), () => ({ services: { emailDelivery: "invalid" } })]) {
      const result = await dispatchCampaign({ ...SEND, decision, getReadiness: readiness, appendLedger: async () => ({ ok: true }), fetchImpl: okFetch(calls) });
      assert.equal(result.ok, false);
      assert.equal(result.code, "email_not_configured");
    }
    assert.equal(calls.length, 0, "nothing may be sent while delivery is unconfigured");
  });

  it("sends nothing without a credential, even when readiness says otherwise", async () => {
    // Two independent gates. Readiness is derived and could be wrong; the
    // absence of a key is a fact.
    const decision = authorised([{ email: "a@example.com", consent: CONSENTED }]);
    const calls = [];
    const result = await dispatchCampaign({
      ...SEND,
      decision,
      getEnv: () => undefined,
      appendLedger: async () => ({ ok: true }),
      fetchImpl: okFetch(calls)
    });
    assert.equal(result.code, "email_not_configured");
    assert.equal(calls.length, 0);
  });

  it("refuses without an organization or a campaign id", async () => {
    const decision = authorised([{ email: "a@example.com", consent: CONSENTED }]);
    const calls = [];

    const noOrg = await dispatchCampaign({ ...SEND, organizationId: null, decision, appendLedger: async () => ({ ok: true }), fetchImpl: okFetch(calls) });
    assert.equal(noOrg.code, "no_organization");

    // Without a campaign id the idempotency key would differ per attempt, so a
    // retry would charge twice and the ledger's unique index would not catch it.
    const noCampaign = await dispatchCampaign({ ...SEND, campaignId: null, decision, appendLedger: async () => ({ ok: true }), fetchImpl: okFetch(calls) });
    assert.equal(noCampaign.code, "no_campaign_id");

    assert.equal(calls.length, 0);
  });

  it("refuses an empty subject or body rather than sending a blank email", async () => {
    const decision = authorised([{ email: "a@example.com", consent: CONSENTED }]);
    const calls = [];
    for (const overrides of [{ subject: "" }, { body: "" }, { subject: "   " }, { body: "  " }]) {
      const result = await dispatchCampaign({ ...SEND, ...overrides, decision, appendLedger: async () => ({ ok: true }), fetchImpl: okFetch(calls) });
      assert.equal(result.code, "empty_message");
    }
    assert.equal(calls.length, 0);
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
      const decision = authorised([
        { email: "a@example.com", consent: CONSENTED },
        { email: "b@example.com", consent: CONSENTED },
        { email: "c@example.com", consent: CONSENTED },
      ]);

      const rows = [];
      const fetchImpl = async (url, options) => (JSON.parse(options.body).to[0] === "a@example.com" ? { ok: true, status: 200 } : { ok: false, status: 500 });

      const result = await dispatchCampaign({
        ...SEND,
        decision,
        appendLedger: async (row) => {
          rows.push(row);
          return { ok: true };
        },
        fetchImpl
      });

      assert.equal(result.sent, 1);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].units, 1, "three attempted, one accepted, one charged");
      assert.equal(rows[0].amount_minor, quote("campaign_email", 1).chargeMinor);
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
        fetchImpl: okFetch([])
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
      const result = await dispatchCampaign({ ...SEND, decision, appendLedger: null, report: (d) => reported.push(d), fetchImpl: okFetch([]) });

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
          fetchImpl: okFetch([])
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
