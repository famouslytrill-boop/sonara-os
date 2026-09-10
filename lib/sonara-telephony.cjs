"use strict";

// Carrier calls and text messages: who may be reached, who may reach us, and
// what each costs.
//
// This is the last of the three capability gaps against competitors, and the
// only one that genuinely needs a vendor. Jobber sells an AI Receptionist that
// books jobs from inbound calls, Housecall Pro has CSR AI auto-booking, and
// ServiceTitan reports 22% drive-time reduction from AI dispatch. Nothing here
// answered a phone.
//
// What DID exist is most of the rest, and it matters for scoping this:
// `docs/architecture/2026-08-26-ZERO-MARGIN-COMMS.md` records WebRTC calling
// from a customer record (built 27 August), Web Push messaging, `.ics`
// calendar, GPS, scheduling and click-to-text from the owner's own handset --
// seven of eight capabilities, at no marginal cost. The genuine gap is narrow:
// **the public phone network**. A stranger dialling a number, and a text to
// somebody who has not opened our site.
//
// ## The asymmetry that shapes this file
//
// Outbound and inbound are not the same decision, and treating them alike gets
// one of them wrong:
//
//   * **Outbound** -- we contact somebody. They must have consented, on the
//     `sms` or `phone` channel specifically, and a bulk send is a customer
//     campaign requiring the owner's approval. Consent is the whole question.
//   * **Inbound** -- somebody rings us. **Consent does not apply**: they
//     initiated it, and demanding a consent record before answering the phone
//     would be absurd. What applies instead is cost, because a carrier bills
//     for the minutes either way, and authority, because what an agent DOES on
//     that call is a separate question from whether the call is answered.
//
// Getting that backwards in either direction is a real fault: requiring consent
// to answer a call makes the product useless, and skipping it on outbound is
// the violation AGENTS.md exists to prevent.
//
// ## What this file does not do
//
// It picks no vendor. `lib/sonara-paid-capabilities.cjs` already requires
// `SONARA_TELEPHONY_PROVIDER_URL` -- a URL rather than a named carrier -- which
// is the same adapter shape as the Open Media Worker: the owner hosts or rents
// whatever they like, and the application speaks one contract to it. A serverless
// function cannot hold a carrier trunk any more than it can hold a GPU.

const { authoriseUsage } = require("./sonara-usage-meter.cjs");
const { consentState } = require("./growth-studio-sender.cjs");
const { classifyAction } = require("./sonara-agent-authority.cjs");

const BILLED_CAPABILITY = "telephony";

// The unit is `message_or_minute`. One text is one unit; a call is billed per
// minute, rounded up, because that is how every carrier bills and pretending
// otherwise would put us underwater on every part-minute.
//
// The price and the floor are deliberately NOT repeated here. This comment used
// to say "priced at 3 minor units against a 0.8 floor", and when the floor was
// corrected to 1.4 on 10 September 2026 -- 0.8 was unsourced and below the real
// cost on every vendor -- this line went stale and said the old number in a file
// nobody would think to check. `lib/sonara-paid-capabilities.cjs` is the one
// place those figures live, with their source and the date they were read.
const MINIMUM_BILLABLE_UNITS = 1;

// A call of unknown length cannot be authorised for its real cost, so a floor is
// authorised up front and the true duration is drawn at the end. One minute is
// deliberately small: authorising ten would refuse customers who can afford the
// call they are actually about to have.
const INBOUND_AUTHORISATION_MINUTES = 1;

function billableMinutes(seconds) {
  const parsed = seconds === null || seconds === undefined || seconds === "" ? null : Number(seconds);
  if (parsed === null || !Number.isFinite(parsed) || parsed < 0) return null;
  // Rounded up, and a connected call of zero seconds still bills one minute --
  // a carrier charges for the connection. `Math.ceil(0)` is 0, which would bill
  // nothing for a call that cost us something.
  return Math.max(Math.ceil(parsed / 60), MINIMUM_BILLABLE_UNITS);
}

// ---------------------------------------------------------------------------
// Outbound: we contact them.
// ---------------------------------------------------------------------------

// One text or call to one person. `channel` decides which consent counts:
// `growth_contact_consents` records permission per channel, and a permission to
// email is not a permission to text.
// `channel` has deliberately NO default.
//
// It was `channel = "sms"`, and a test asking whether an unnamed channel is
// guessed at found that `undefined` fell through to sms -- so a caller who
// forgot the argument would text somebody on the strength of a default. The
// channel is what decides which consent counts, so it is the one argument that
// must be stated rather than assumed.
function authoriseOutbound({
  recipient = null,
  channel,
  history = null,
  allowanceMinor = 0,
  units = 1,
  now = Date.now(),
} = {}) {
  if (channel !== "sms" && channel !== "phone") {
    // Refused rather than defaulted to sms. A channel nobody named is not a
    // channel whose consent can be checked.
    return { allowed: false, code: "unsupported_channel", reason: `${channel} is not a carrier channel this can authorise.` };
  }

  const state = consentState(recipient, now, { channel });
  if (state !== "eligible") {
    return {
      allowed: false,
      code: state,
      reason:
        state === "no_consent"
          ? `No ${channel} permission on file for them. Nothing was sent and nothing was charged.`
          : `Their ${channel} permission cannot be used: ${state.replaceAll("_", " ")}.`,
    };
  }

  const decision = authoriseUsage({ capability: BILLED_CAPABILITY, units, history, allowanceMinor });
  if (!decision.allowed) return { allowed: false, code: decision.code, reason: decision.reason, quote: decision.quote };

  return {
    allowed: true,
    code: "authorised",
    reason: decision.reason,
    channel,
    quote: decision.quote,
    drawMinor: decision.drawMinor,
    remainingMinor: decision.remainingMinor,
  };
}

// Many texts or calls at once. This is a customer campaign, and AGENTS.md does
// not permit automating one without the owner's approval -- so the approval is
// required here rather than assumed to have happened upstream.
function authoriseOutboundCampaign({ approval = null, recipients = [], channel, history = null, allowanceMinor = 0, now = Date.now() } = {}) {
  // No default here either, and checked before the approval: a campaign whose
  // channel nobody named cannot have its consent checked, so there is nothing
  // an approval could authorise.
  if (channel !== "sms" && channel !== "phone") {
    return { allowed: false, code: "unsupported_channel", reason: `${channel} is not a carrier channel this can authorise.`, eligible: [], skipped: [] };
  }
  if (!approval || approval.status !== "approved" || !approval.approved_by) {
    return {
      allowed: false,
      code: "owner_approval_required",
      reason: "A bulk text or call to customers needs your approval first. Nothing was sent and nothing was charged.",
      eligible: [],
      skipped: [],
    };
  }

  const eligible = [];
  const skipped = [];
  const seen = new Set();

  for (const recipient of Array.isArray(recipients) ? recipients : []) {
    const number = String(recipient?.phone || recipient?.number || "").replace(/[^\d+]/g, "");
    if (number.length < 7) {
      skipped.push({ recipient, reason: "no_number", detail: "No usable phone number recorded." });
      continue;
    }
    if (seen.has(number)) {
      skipped.push({ recipient, reason: "duplicate", detail: "The same number appears more than once; it was contacted once." });
      continue;
    }
    const state = consentState(recipient, now, { channel });
    if (state !== "eligible") {
      skipped.push({ recipient, reason: state, detail: `Their ${channel} permission cannot be used: ${state.replaceAll("_", " ")}.` });
      continue;
    }
    seen.add(number);
    eligible.push({ ...recipient, phone: number });
  }

  if (eligible.length === 0) {
    return {
      allowed: false,
      code: "no_consented_recipients",
      reason: `Nobody on this list of ${Array.isArray(recipients) ? recipients.length : 0} can be contacted by ${channel}.`,
      eligible: [],
      skipped,
    };
  }

  // Billed on who is contacted, not on the list. The same rule as campaign
  // email, and for the same reason: charging for the rest would be charging for
  // the sends consent prevented.
  const decision = authoriseUsage({ capability: BILLED_CAPABILITY, units: eligible.length, history, allowanceMinor });
  if (!decision.allowed) {
    return { allowed: false, code: decision.code, reason: decision.reason, eligible: [], skipped, quote: decision.quote };
  }

  return {
    allowed: true,
    code: "authorised",
    reason: `Contacting ${eligible.length} of ${recipients.length} by ${channel}${skipped.length ? `, skipping ${skipped.length}` : ""}. ${decision.quote.display}.`,
    eligible,
    skipped,
    quote: decision.quote,
    drawMinor: decision.drawMinor,
  };
}

// ---------------------------------------------------------------------------
// Inbound: they contact us.
// ---------------------------------------------------------------------------

// May this call be answered, and what may the agent do on it?
//
// Consent is deliberately not consulted. The caller dialled us; requiring a
// consent record before picking up would refuse the customers the feature exists
// to serve. What is consulted is credit, because the carrier bills for the
// minutes regardless of who dialled.
//
// `intendedActions` is the second half and the more important one. An answering
// machine is harmless; an agent that books a job, takes a payment or changes a
// record on a phone call is doing the same things the authority module governs
// everywhere else, and a phone call is not an exemption from it. Each intended
// action is classified, and any that needs the owner is reported as needing them
// -- so the call can still be answered and the action still waits.
function authoriseInbound({ history = null, allowanceMinor = 0, intendedActions = [] } = {}) {
  const decision = authoriseUsage({
    capability: BILLED_CAPABILITY,
    units: INBOUND_AUTHORISATION_MINUTES,
    history,
    allowanceMinor,
  });

  if (!decision.allowed) {
    return {
      allowed: false,
      code: decision.code,
      reason:
        decision.code === "insufficient_credit"
          ? "There is not enough credit to answer a call. The caller was not answered and nothing was charged."
          : decision.reason,
      quote: decision.quote,
      actions: [],
    };
  }

  // Classified, never decided here. sonara-agent-authority.cjs owns the seven
  // categories and its default is deny, so an action nobody has named arrives
  // as needing the owner rather than as permitted.
  const actions = (Array.isArray(intendedActions) ? intendedActions : []).map((actionType) => {
    const classified = classifyAction(actionType);
    return {
      actionType,
      permitted: !classified.requiresOwnerApproval,
      category: classified.category,
      reason: classified.reason,
    };
  });

  return {
    allowed: true,
    code: "authorised",
    reason: `The call may be answered. ${decision.quote.display} authorised up front; the real duration is charged when it ends.`,
    quote: decision.quote,
    authorisedMinutes: INBOUND_AUTHORISATION_MINUTES,
    actions,
    // Named separately so a caller can show the owner what the agent could not
    // do, rather than the agent silently doing less than the owner expected.
    actionsNeedingOwner: actions.filter((entry) => !entry.permitted).map((entry) => entry.actionType),
  };
}

// What a finished call actually costs. Called when the carrier reports the
// duration, which is the only honest moment to charge a per-minute bill.
function settleCall({ seconds } = {}) {
  const minutes = billableMinutes(seconds);
  if (minutes === null) {
    // Refused rather than defaulted to zero or to one. A duration nobody can
    // read is not a duration of nothing, and guessing either way is a wrong
    // number on an invoice.
    return { ok: false, code: "unreadable_duration", detail: String(seconds) };
  }
  return { ok: true, capability: BILLED_CAPABILITY, units: minutes, detail: `${minutes} billable minute${minutes === 1 ? "" : "s"}.` };
}

module.exports = {
  BILLED_CAPABILITY,
  MINIMUM_BILLABLE_UNITS,
  INBOUND_AUTHORISATION_MINUTES,
  billableMinutes,
  authoriseOutbound,
  authoriseOutboundCampaign,
  authoriseInbound,
  settleCall,
};
