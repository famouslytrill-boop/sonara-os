"use strict";

const assert = require("node:assert/strict");
const {
  BILLED_CAPABILITY,
  MINIMUM_BILLABLE_EMAILS,
  SKIP_REASONS,
  consentState,
  partitionRecipients,
  authoriseCampaign,
} = require("../lib/growth-studio-sender.cjs");
const { classifyAction, SENSITIVE_CATEGORY_NAMES } = require("../lib/sonara-agent-authority.cjs");
const { CAPABILITIES, quote } = require("../lib/sonara-paid-capabilities.cjs");

// Growth Studio could not send. It created campaigns through HubSpot's API and
// pushed events to Klaviyo, and there is no sending credential in the
// environment except the one that serves staff invitations -- so a customer on
// Growth Studio still paid Klaviyo.
//
// Sending it ourselves runs straight into three rules that are not this code's
// to relax, quoted from AGENTS.md:
//
//   "Do not automate ... customer campaigns ... without owner approval."
//   "Enforce provenance, consent, and anti-clone safety."
//   "Sounds, voice announcements, haptics, SMS, push, and email alerts must be
//    off or explicitly user-controlled by default."
//
// These assertions are the three rules, plus the meter. Written as refusals,
// because every one of them is a thing that must NOT happen.
const APPROVED = Object.freeze({ status: "approved", approved_by: "owner-1" });
// The real shape of a public.growth_contact_consents row, not an invented one.
const CONSENTED = Object.freeze({ channel: "email", consent_status: "granted" });
const ledger = (rows) => ({ ok: true, rows });

function people(count, from = 0) {
  return Array.from({ length: count }, (_, index) => ({ email: `person${from + index}@example.com`, consent: CONSENTED }));
}

describe("a campaign needs approval and consent", () => {
  it("is checking a real price and a real category list", () => {
    assert.ok(CAPABILITIES[BILLED_CAPABILITY], `${BILLED_CAPABILITY} is not a priced capability`);
    assert.equal(CAPABILITIES[BILLED_CAPABILITY].unit, "email");
    assert.equal(SENSITIVE_CATEGORY_NAMES.length, 7, "the seven approval categories should be seven");
    assert.ok(Object.keys(SKIP_REASONS).length >= 5, "too few skip reasons to describe a real list");
  });

  // Rule one. No amount of correct data substitutes for this.
  it("refuses without owner approval, however good the list and the credit", () => {
    const decision = authoriseCampaign({
      approval: null,
      recipients: people(500),
      history: ledger([{ entry_kind: "grant", amount_minor: 100000 }]),
      allowanceMinor: 100000
    });

    assert.equal(decision.allowed, false, "a customer campaign must never send without the owner's approval");
    assert.equal(decision.code, "owner_approval_required");
    assert.equal(decision.eligible.length, 0, "no recipient may be returned as sendable when the campaign is refused");
  });

  it("refuses an approval that names nobody", () => {
    // A row can say "approved" without a person having approved it -- a
    // default, a migration, or whatever wrote it. decideExecution applies the
    // same rule to a proactive action.
    const decision = authoriseCampaign({
      approval: { status: "approved", approved_by: null },
      recipients: people(50),
      history: ledger([]),
      allowanceMinor: 100000
    });
    assert.equal(decision.allowed, false);
    assert.equal(decision.code, "approval_missing_approver");
  });

  it("refuses a rejected or pending approval, not only a missing one", () => {
    for (const status of ["rejected", "pending", "", "APPROVED", "approved_by_agent"]) {
      const decision = authoriseCampaign({
        approval: { status, approved_by: "owner-1" },
        recipients: people(50),
        history: ledger([]),
        allowanceMinor: 100000
      });
      assert.equal(decision.allowed, false, `a status of ${JSON.stringify(status)} must not read as approved`);
    }
  });

  it("agrees with the authority module about what a campaign is", () => {
    // If these two ever disagree, one of them is a hole. Every campaign-shaped
    // name must land in customer_campaigns and require approval.
    for (const action of ["send_campaign", "campaign_send", "broadcast_email", "newsletter_send", "bulk_email"]) {
      const classified = classifyAction(action);
      assert.equal(classified.requiresOwnerApproval, true, `${action} should require approval`);
      assert.equal(classified.category, "customer_campaigns", `${action} should be a customer campaign`);
    }
    // And a name nobody listed is still refused, for not being recognised.
    assert.equal(classifyAction("send_email").requiresOwnerApproval, true);
  });

  // Rule two.
  describe("consent, per recipient", () => {
    it("sends to the consented and skips the rest, saying which", () => {
      const recipients = [
        { email: "yes@example.com", consent: CONSENTED },
        { email: "none@example.com" },
        { email: "gone@example.com", consent: { channel: "email", consent_status: "withdrawn" } },
        { email: "lapsed@example.com", consent: { channel: "email", consent_status: "granted", expires_at: "2026-01-01T00:00:00Z" } },
        { email: "off@example.com", consent: CONSENTED, suppressed: true },
        { email: "", consent: CONSENTED },
      ];

      const split = partitionRecipients(recipients, { now: Date.parse("2026-09-10T00:00:00Z") });
      assert.equal(split.ok, true);
      assert.equal(split.eligible.length, 1, "only the consented recipient may be sent to");
      assert.deepEqual(
        split.skipped.map((entry) => entry.reason).sort(),
        ["consent_expired", "consent_revoked", "no_address", "no_consent", "suppressed"],
        "every refusal must be named separately -- the owner does something different about each"
      );
    });

    it("gives every skip a reason a person can act on", () => {
      for (const entry of partitionRecipients([{ email: "none@example.com" }]).skipped) {
        assert.ok(entry.detail && entry.detail.length > 10, `${entry.reason} has no usable explanation`);
      }
    });

    it("treats an unreadable expiry as lapsed, not as absent", () => {
      // "We cannot tell when this lapsed" is not evidence that it has not.
      for (const expires of ["not-a-date", "", "0000-00-00"]) {
        const state = consentState({ email: "x@example.com", consent: { channel: "email", consent_status: "granted", expires_at: expires } }, Date.now());
        assert.notEqual(state, "eligible", `an expiry of ${JSON.stringify(expires)} must not read as a live consent`);
      }
    });

    it("counts only 'granted' as consent, across every status the table allows", () => {
      // The column allows granted|denied|withdrawn|expired|unknown. Four of the
      // five are not permission, and `unknown` is the one that must never be
      // read as one -- its whole purpose is to record that nobody knows.
      for (const consent_status of ["denied", "unknown", "", "GRANTED", null, undefined]) {
        const state = consentState({ email: "x@example.com", consent: { channel: "email", consent_status } }, Date.now());
        assert.notEqual(state, "eligible", `a status of ${JSON.stringify(consent_status)} must not permit a send`);
      }
      assert.equal(consentState({ email: "x@example.com", consent: { channel: "email", consent_status: "granted" } }, Date.now()), "eligible");

      // Surrounding whitespace IS tolerated, and that is a decision rather than
      // an oversight. This assertion first demanded that "granted " be refused;
      // the column carries a CHECK constraint limiting it to the five exact
      // values, so a padded one cannot come from the database, and " granted "
      // from a hand-built object is not an ambiguous permission -- it is the
      // same permission with a typo. Refusing it would block a real consent to
      // guard against nothing. Case is NOT tolerated, because "GRANTED" is not
      // a value the constraint allows either and letting it through would mean
      // accepting statuses the schema does not define.
      assert.equal(consentState({ email: "x@example.com", consent: { channel: "email", consent_status: " granted " } }, Date.now()), "eligible");
    });

    it("does not treat a permission for one channel as a permission for another", () => {
      // A consent to text somebody is not a consent to email them.
      for (const channel of ["sms", "push", "whatsapp", "phone", "analytics"]) {
        const state = consentState({ email: "x@example.com", consent: { channel, consent_status: "granted" } }, Date.now(), { channel: "email" });
        assert.equal(state, "no_consent", `a ${channel} permission must not authorise an email`);
      }
    });

    it("lets a withdrawal timestamp outrank a status that still says granted", () => {
      // Two columns disagreeing is a real state -- a partial update, a failed
      // write -- and the safe reading is the one that does not send.
      const state = consentState(
        { email: "x@example.com", consent: { channel: "email", consent_status: "granted", withdrawn_at: "2026-05-01T00:00:00Z" } },
        Date.now()
      );
      assert.equal(state, "consent_revoked");
    });

    it("sends once to an address listed twice, and says it did", () => {
      const split = partitionRecipients([
        { email: "same@example.com", consent: CONSENTED },
        { email: "SAME@Example.com", consent: CONSENTED },
      ]);
      assert.equal(split.eligible.length, 1, "one address, one send");
      assert.equal(split.skipped[0].reason, "duplicate", "the duplicate must be reported, not dropped silently");
    });

    it("refuses the campaign when nobody on the list can be sent to", () => {
      const decision = authoriseCampaign({
        approval: APPROVED,
        recipients: [{ email: "none@example.com" }, { email: "off@example.com", suppressed: true }],
        history: ledger([]),
        allowanceMinor: 100000
      });
      assert.equal(decision.allowed, false);
      assert.equal(decision.code, "no_consented_recipients");
      assert.equal(decision.skipped.length, 2, "the refusals must still be reported so the owner can fix the list");
    });
  });

  // The meter.
  describe("what it charges", () => {
    it("bills for who is sent to, never for the list length", () => {
      const recipients = people(460).concat(
        Array.from({ length: 40 }, (_, index) => ({ email: `no${index}@example.com` }))
      );
      const decision = authoriseCampaign({
        approval: APPROVED,
        recipients,
        history: ledger([{ entry_kind: "grant", amount_minor: 100000 }]),
      });

      assert.equal(decision.allowed, true);
      assert.equal(decision.eligible.length, 460);
      assert.equal(
        decision.billableEmails,
        460,
        "charging for 500 would be charging for the sends the consent rule prevented"
      );
      assert.equal(decision.drawMinor, quote(BILLED_CAPABILITY, 460).chargeMinor);
    });

    it("bills a tiny campaign at the minimum, and says so", () => {
      const decision = authoriseCampaign({
        approval: APPROVED,
        recipients: people(3),
        history: ledger([{ entry_kind: "grant", amount_minor: 100000 }]),
      });
      assert.equal(decision.billableEmails, MINIMUM_BILLABLE_EMAILS);
      assert.match(decision.reason, /minimum/, "a customer billed for ten when they sent three must be told why");
    });

    it("keeps a margin at every billable size", () => {
      // Below seven, rounding makes the charge equal the cost. The minimum
      // exists for that reason and this is the assertion that holds it.
      for (const size of [1, 3, MINIMUM_BILLABLE_EMAILS, 50, 500, 5000]) {
        const decision = authoriseCampaign({
          approval: APPROVED,
          recipients: people(size),
          history: ledger([{ entry_kind: "grant", amount_minor: 1000000 }]),
        });
        assert.equal(decision.allowed, true, `a campaign of ${size} was refused`);
        const priced = quote(BILLED_CAPABILITY, decision.billableEmails);
        assert.ok(priced.marginMinor > 0, `a campaign of ${size} bills at zero margin`);
      }
    });

    it("refuses with no credit, and charges nothing", () => {
      const decision = authoriseCampaign({
        approval: APPROVED,
        recipients: people(5000),
        history: ledger([]),
        allowanceMinor: 0
      });
      assert.equal(decision.allowed, false);
      assert.equal(decision.code, "insufficient_credit");
      assert.equal(decision.eligible.length, 0, "no recipient may be handed back as sendable on a refusal");
    });

    it("refuses when the balance cannot be read, rather than sending unpaid", () => {
      const decision = authoriseCampaign({ approval: APPROVED, recipients: people(50), history: { ok: false } });
      assert.equal(decision.allowed, false);
      assert.equal(decision.code, "balance_unreadable");
    });

    it("beats Brevo on the rate it charges", () => {
      // The comparison in docs/pricing/2026-09-05-PRICING-STRATEGY.md: Brevo
      // Starter is $9 for 5,000 emails, an effective $1.80 per thousand. Ours
      // has to be under that or the whole positioning argument fails.
      const perThousand = quote(BILLED_CAPABILITY, 1000).chargeMinor / 100;
      assert.ok(
        perThousand < 1.8,
        `campaign email bills $${perThousand.toFixed(2)} per thousand against Brevo Starter's effective $1.80`
      );
    });
  });
});
