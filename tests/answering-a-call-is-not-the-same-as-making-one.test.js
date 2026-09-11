"use strict";

const assert = require("node:assert/strict");
const {
  BILLED_CAPABILITY,
  INBOUND_AUTHORISATION_MINUTES,
  billableMinutes,
  authoriseOutbound,
  authoriseOutboundCampaign,
  authoriseInbound,
  settleCall,
} = require("../lib/sonara-telephony.cjs");
const { CAPABILITIES, quote } = require("../lib/sonara-paid-capabilities.cjs");
const { SELF_SERVE_ACTIONS } = require("../lib/sonara-agent-authority.cjs");

// Outbound and inbound are not the same decision, and treating them alike gets
// one of them wrong in a way that matters:
//
//   * Requiring consent before ANSWERING a call makes the feature useless. The
//     caller dialled us. Demanding a consent record first would refuse exactly
//     the customers an inbound line exists to serve.
//   * Skipping consent on OUTBOUND is the violation AGENTS.md exists to
//     prevent, and a carrier text to somebody who never agreed is the most
//     visible way to commit it.
//
// So these assertions are mostly about keeping the two apart. The shared half is
// cost: a carrier bills for the minutes whoever dialled.
const CONSENT = (channel) => ({ channel, consent_status: "granted" });
const ledger = (rows) => ({ ok: true, rows });
const FUNDED = 100000;

describe("answering a call is not the same as making one", () => {
  it("is checking a real priced capability", () => {
    assert.ok(CAPABILITIES[BILLED_CAPABILITY], "telephony is not priced");
    assert.equal(CAPABILITIES[BILLED_CAPABILITY].unit, "message_or_minute");
    assert.ok(quote(BILLED_CAPABILITY, 10).marginMinor > 0, "telephony bills at no margin");
  });

  describe("outbound needs consent, on the right channel", () => {
    it("refuses without any consent", () => {
      const decision = authoriseOutbound({ recipient: {}, channel: "sms", history: ledger([]), allowanceMinor: FUNDED });
      assert.equal(decision.allowed, false);
      assert.equal(decision.code, "no_consent");
    });

    it("does not accept an email permission as permission to text", () => {
      // growth_contact_consents records permission per channel for exactly this
      // reason. A customer who agreed to a newsletter has not agreed to texts.
      const decision = authoriseOutbound({
        recipient: { consent: CONSENT("email") },
        channel: "sms",
        history: ledger([]),
        allowanceMinor: FUNDED
      });
      assert.equal(decision.allowed, false, "an email consent must never authorise a carrier text");
      assert.equal(decision.code, "no_consent");
    });

    it("does not accept an sms permission as permission to call", () => {
      const decision = authoriseOutbound({
        recipient: { consent: CONSENT("sms") },
        channel: "phone",
        history: ledger([]),
        allowanceMinor: FUNDED
      });
      assert.equal(decision.allowed, false, "a text permission is not a permission to ring somebody");
    });

    it("sends when the consent matches the channel and there is credit", () => {
      for (const channel of ["sms", "phone"]) {
        const decision = authoriseOutbound({
          recipient: { consent: CONSENT(channel) },
          channel,
          history: ledger([]),
          allowanceMinor: FUNDED
        });
        assert.equal(decision.allowed, true, `a matching ${channel} consent should authorise`);
      }
    });

    it("refuses a channel nobody named rather than defaulting to sms", () => {
      for (const channel of ["", "email", "push", "whatsapp", null, undefined]) {
        const decision = authoriseOutbound({
          recipient: { consent: CONSENT("sms") },
          channel,
          history: ledger([]),
          allowanceMinor: FUNDED
        });
        assert.equal(decision.allowed, false, `a channel of ${JSON.stringify(channel)} must not be guessed at`);
      }
    });

    it("refuses without credit even with perfect consent", () => {
      const decision = authoriseOutbound({
        recipient: { consent: CONSENT("sms") },
        channel: "sms",
        history: ledger([]),
        allowanceMinor: 0
      });
      assert.equal(decision.allowed, false);
      assert.equal(decision.code, "insufficient_credit");
    });
  });

  describe("a bulk outbound is a customer campaign", () => {
    it("refuses without owner approval", () => {
      const decision = authoriseOutboundCampaign({
        approval: null,
        channel: "sms",
        recipients: [{ phone: "+15550100", consent: CONSENT("sms") }],
        history: ledger([]),
        allowanceMinor: FUNDED
      });
      assert.equal(decision.allowed, false, "AGENTS.md does not permit automating a customer campaign");
      assert.equal(decision.code, "owner_approval_required");
    });

    it("refuses an approval nobody signed", () => {
      const decision = authoriseOutboundCampaign({
        approval: { status: "approved", approved_by: null },
        channel: "sms",
        recipients: [{ phone: "+15550100", consent: CONSENT("sms") }],
        history: ledger([]),
        allowanceMinor: FUNDED
      });
      assert.equal(decision.allowed, false);
    });

    it("reports an unnamed channel before an unapproved campaign, because one is a caller bug", () => {
      // Ordering, and it is a choice. A missing channel is a programming error
      // -- no caller legitimately omits it -- and should surface loudly. A
      // missing approval is a real user-facing state. So the bug is reported
      // first rather than being masked by the legitimate refusal behind it.
      const decision = authoriseOutboundCampaign({
        approval: null,
        recipients: [{ phone: "+15550100", consent: CONSENT("sms") }],
        history: ledger([]),
        allowanceMinor: FUNDED
      });
      assert.equal(decision.code, "unsupported_channel");
    });

    it("bills for who is contacted, not for the list", () => {
      const recipients = [
        { phone: "+15550100", consent: CONSENT("sms") },
        { phone: "+15550101", consent: CONSENT("sms") },
        { phone: "+15550102" },
        { phone: "+15550100", consent: CONSENT("sms") },
        { phone: "junk", consent: CONSENT("sms") },
      ];
      const decision = authoriseOutboundCampaign({
        approval: { status: "approved", approved_by: "owner-1" },
        channel: "sms",
        recipients,
        history: ledger([{ entry_kind: "grant", amount_minor: FUNDED }]),
      });

      assert.equal(decision.allowed, true);
      assert.equal(decision.eligible.length, 2, "two usable, consented, distinct numbers");
      assert.equal(decision.drawMinor, quote(BILLED_CAPABILITY, 2).chargeMinor, "charging for five would charge for what consent prevented");
      assert.deepEqual(
        decision.skipped.map((entry) => entry.reason).sort(),
        ["duplicate", "no_consent", "no_number"],
        "each refusal named separately"
      );
    });
  });

  // The half that is easy to get wrong in the other direction.
  describe("inbound does not need consent, because they rang us", () => {
    it("answers a caller with no consent record at all", () => {
      const decision = authoriseInbound({ history: ledger([]), allowanceMinor: FUNDED });
      assert.equal(
        decision.allowed,
        true,
        "requiring a consent record before answering the phone would refuse the customers the line exists for"
      );
    });

    it("still refuses when there is no credit, because the carrier bills either way", () => {
      const decision = authoriseInbound({ history: ledger([]), allowanceMinor: 0 });
      assert.equal(decision.allowed, false);
      assert.equal(decision.code, "insufficient_credit");
      assert.match(decision.reason, /not answered/, "the owner needs to know a caller was turned away");
    });

    it("refuses when the balance cannot be read, rather than answering unpaid", () => {
      const decision = authoriseInbound({ history: { ok: false } });
      assert.equal(decision.allowed, false);
      assert.equal(decision.code, "balance_unreadable");
    });

    it("authorises a floor up front rather than an unknown call length", () => {
      const decision = authoriseInbound({ history: ledger([]), allowanceMinor: FUNDED });
      assert.equal(decision.authorisedMinutes, INBOUND_AUTHORISATION_MINUTES);
      assert.ok(
        INBOUND_AUTHORISATION_MINUTES <= 1,
        "authorising more than a minute would refuse customers who can afford the call they are about to have"
      );
    });

    // The more important half of inbound.
    it("does not let a phone call become an exemption from the approval rules", () => {
      const decision = authoriseInbound({
        history: ledger([]),
        allowanceMinor: FUNDED,
        intendedActions: ["issue_refund", "change_payout_account", "delete_customer", "send_campaign"]
      });

      assert.equal(decision.allowed, true, "the call may still be answered");
      assert.deepEqual(
        decision.actionsNeedingOwner.sort(),
        ["change_payout_account", "delete_customer", "issue_refund", "send_campaign"],
        "an agent on a call is doing the same things the authority module governs everywhere else"
      );
      for (const action of decision.actions) {
        assert.equal(action.permitted, false);
        assert.ok(action.reason && action.reason.length > 10, `${action.actionType} has no explanation to show the owner`);
      }
    });

    it("permits the actions that are actually on the unattended list", () => {
      const permitted = SELF_SERVE_ACTIONS.map((entry) => entry.action);
      const decision = authoriseInbound({ history: ledger([]), allowanceMinor: FUNDED, intendedActions: permitted });
      assert.equal(decision.actionsNeedingOwner.length, 0, "the seven unattended actions should not need approval on a call");
    });

    it("sends an unrecognised action to the owner rather than allowing it", () => {
      // Booking a job from a call is what Jobber's AI Receptionist does, and it
      // is NOT on our unattended list, so it arrives here needing the owner.
      // That is the default-deny working as designed; whether to add it is a
      // product decision and not this file's to make.
      const decision = authoriseInbound({
        history: ledger([]),
        allowanceMinor: FUNDED,
        intendedActions: ["book_appointment", "something_nobody_listed"]
      });
      assert.equal(decision.actionsNeedingOwner.length, 2);
    });
  });

  describe("what a finished call costs", () => {
    it("rounds part minutes up, the way a carrier bills", () => {
      assert.equal(billableMinutes(1), 1);
      assert.equal(billableMinutes(60), 1);
      assert.equal(billableMinutes(61), 2);
      assert.equal(billableMinutes(119), 2);
      assert.equal(billableMinutes(600), 10);
    });

    it("bills a connected call of zero seconds as one minute", () => {
      // Math.ceil(0) is 0, which would bill nothing for a connection the
      // carrier charged us for.
      assert.equal(billableMinutes(0), 1);
      assert.equal(settleCall({ seconds: 0 }).units, 1);
    });

    it("refuses an unreadable duration rather than guessing", () => {
      for (const seconds of ["abc", null, undefined, "", -5, NaN]) {
        const settled = settleCall({ seconds });
        assert.equal(settled.ok, false, `a duration of ${JSON.stringify(seconds)} must not produce a charge`);
        assert.equal(settled.code, "unreadable_duration");
      }
    });

    it("charges the real duration, which may exceed what was authorised", () => {
      const authorised = authoriseInbound({ history: ledger([]), allowanceMinor: FUNDED });
      const settled = settleCall({ seconds: 600 });
      assert.ok(
        settled.units > authorised.authorisedMinutes,
        "a ten-minute call must bill ten minutes, not the one that was authorised up front"
      );
    });
  });
});
