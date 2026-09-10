"use strict";

// Whether a campaign may be sent, to whom, and what it costs.
//
// Growth Studio could not send. It created campaigns through HubSpot's API and
// pushed events to Klaviyo, and `scripts/verify-env.mjs` classifies no sending
// credential except `RESEND_API_KEY`, which serves staff invitations. So a
// customer on Growth Studio still paid Klaviyo.
//
// This is the decision half of sending it ourselves. It sends nothing: it
// decides. The dispatch is the caller's, and keeping them apart is deliberate --
// a function that both decides and sends is a function whose refusals cannot be
// tested without a mail server.
//
// ## Three rules that are not this file's to relax
//
// AGENTS.md, quoted rather than paraphrased:
//
//   "Do not automate refunds, payout changes, legal/policy publishing, customer
//    campaigns, proof/review publishing, security setting changes, or
//    destructive data changes without owner approval."
//
//   "Enforce provenance, consent, and anti-clone safety."
//
//   "Sounds, voice announcements, haptics, SMS, push, and email alerts must be
//    off or explicitly user-controlled by default."
//
// So: a campaign needs owner approval, every recipient needs consent, and
// nothing is on by default. `lib/sonara-agent-authority.cjs` already classifies
// every campaign action name under `customer_campaigns` and requires approval --
// including `send_email`, which falls to `unrecognised` and is refused for not
// being recognised at all. This file does not re-implement that judgement; it
// requires the approval to have been given and refuses without one.
//
// ## Why a skipped recipient is counted rather than dropped
//
// A campaign to 500 people where 40 lack consent must send to 460 and say so.
// The alternatives are both worse: refusing the whole campaign punishes the
// owner for data they may not control, and silently sending to 500 is the
// consent violation the rule exists to prevent. Silently sending to 460 is the
// third and worst option, because the owner believes they reached 500 and the
// difference is invisible.

const { authoriseUsage } = require("./sonara-usage-meter.cjs");

const BILLED_CAPABILITY = "campaign_email";

// Below this, rounding leaves no margin.
//
// `quote()` rounds both the charge and the cost up to a whole minor unit, and at
// small counts campaign_email's price and floor round to the same number -- the
// charge equals the cost and the send earns nothing. Ten is the documented
// minimum because it is a round number safely past the point where the two
// separate.
//
// Neither figure is copied into this file. They live in
// `lib/sonara-paid-capabilities.cjs` with their source and the date they were
// read, and `tests/a-cost-floor-is-a-figure-somebody-checked.test.js` derives the
// separation point from them, so this minimum fails if it ever drops to it.
//
// A campaign smaller than ten recipients is billed as ten. That is stated on
// the decision rather than buried, because a customer sending to three people
// and being charged for ten needs to see why.
const MINIMUM_BILLABLE_EMAILS = 10;

// How many emails a send of `count` is billed for.
//
// A function rather than `Math.max` at each site, because there were two sites
// and they disagreed. `authoriseCampaign` reserved credit for the minimum and
// said so in the reason it shows the customer -- "billed at the 10-email
// minimum" -- while `dispatchCampaign` drew for the raw accepted count. So a
// campaign to one person authorised 2 minor units and charged 1, which is
// exactly the zero-margin case this constant exists to prevent, and the number
// in the customer-facing sentence was not the number on the invoice.
//
// Found by the route test asserting the charge against the documented minimum
// instead of against whatever the code produced.
function billableEmailCount(count) {
  const parsed = Number(count);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.max(Math.floor(parsed), MINIMUM_BILLABLE_EMAILS);
}

// A recipient may be sent to when there is a live, unexpired, unrevoked consent
// and no suppression. Each refusal is named separately because the owner does
// something different about each, and "not eligible" tells them nothing.
const SKIP_REASONS = Object.freeze({
  no_consent: "No consent on file. Nothing was sent to them.",
  consent_revoked: "They withdrew consent.",
  consent_expired: "Their consent has lapsed and needs renewing.",
  suppressed: "They unsubscribed or a previous send bounced.",
  no_address: "No email address recorded.",
  duplicate: "The same address appears more than once in this list; it was sent once.",
});

function normaliseAddress(value) {
  const text = String(value == null ? "" : value).trim().toLowerCase();
  // Deliberately not a full RFC validator. The only question here is whether
  // there is something to send to; the provider rejects malformed addresses and
  // reports which, which is a better authority than a regex in this file.
  return text.includes("@") && text.length <= 320 ? text : "";
}

// The consent row is `public.growth_contact_consents`, and this reads its real
// columns rather than a shape invented here.
//
// The first draft of this function expected `{ consent_attested, revoked_at }`,
// which is the CREATOR consent shape from `creator_voice_consents`. The Growth
// Studio table is different and better: `channel` in
// (email|sms|push|whatsapp|phone|personalization|analytics), `consent_status` in
// (granted|denied|withdrawn|expired|unknown), plus `withdrawn_at` and
// `expires_at`. A decision core that cannot be wired to the actual table is a
// decision core that will be quietly bypassed, so it reads that one.
//
// `channel` matters as much as status: a permission to email somebody is not a
// permission to text them, and a sender that ignores the channel column would
// treat the two as one.
const SENDABLE_CONSENT_STATUS = "granted";

// What one consent row says. `consentState` below is what a caller asks,
// because a contact usually has more than one row.
function stateForConsentRow(consent, now, channel) {
  if (!consent) return "no_consent";

  // Wrong channel is "no consent for this", not "consent withheld". They read
  // the same to a sender and differently to an owner, who may hold a valid SMS
  // permission and be wondering why the email did not go.
  const consentChannel = String(consent.channel || "").trim();
  if (consentChannel && consentChannel !== channel) return "no_consent";

  const status = String(consent.consent_status || "").trim();

  // `unknown` is one of the five statuses the table allows, and it is not
  // consent. Reading it as one would be the "absent read as yes" defect on the
  // column whose whole purpose is to record that nobody knows.
  if (status === "withdrawn") return "consent_revoked";
  if (status === "expired") return "consent_expired";
  if (status !== SENDABLE_CONSENT_STATUS) return "no_consent";

  // A withdrawal timestamp outranks a status that still says granted. Two
  // columns disagreeing is a real state -- a partial update, a failed write --
  // and the safe reading is the one that does not send.
  if (consent.withdrawn_at) return "consent_revoked";

  if (consent.expires_at !== null && consent.expires_at !== undefined) {
    const expires = Date.parse(consent.expires_at);
    // An unparseable expiry is treated as lapsed rather than absent. A date
    // nobody can read is not a permission that can be shown to hold, and the
    // safe reading of "we cannot tell when this lapsed" is that it has.
    //
    // `null` is genuinely different and is left alone above: the column is
    // nullable `timestamptz`, so null means no expiry was set, which is a
    // permanent permission rather than a missing one. An empty string is not a
    // value the database produces for that type, so it only arrives from a
    // caller building a row by hand, and it is not read as "no expiry".
    if (!Number.isFinite(expires) || expires <= now) return "consent_expired";
  }

  return "eligible";
}

// Which reason to report when several rows disagree, most serious first.
//
// `consent_revoked` is deliberately at the top rather than "any granted row
// wins". `growth_contact_consents` has one row per channel AND purpose, so a
// contact can genuinely hold a granted row for one purpose and a withdrawal for
// another -- and a withdrawal is a positive instruction to stop, not the absence
// of an instruction. Reading the granted row and sending would be honouring the
// permission a customer gave while ignoring the one they took back.
//
// It costs something real and that is the point: an owner whose contact
// withdrew from one purpose cannot mail them under another until the purposes
// are recorded per campaign, which nothing does yet. Refusing is the side to be
// wrong on, and `SKIP_REASONS.consent_revoked` names it so they can see why.
const CONSENT_PRECEDENCE = Object.freeze(["consent_revoked", "eligible", "consent_expired", "no_consent"]);

// Whether this contact may be sent to on this channel, and if not, why.
//
// Two shapes, because two callers have different data. A test or a caller that
// already picked a row passes `consent`; a route reading
// `growth_contact_consents` gets a LIST -- one row per channel and purpose --
// and passes `consents`. Making the route pick one would put a consent decision
// in a routing file, which is where it would quietly diverge from this one.
function consentState(recipient, now, { channel = "email" } = {}) {
  if (recipient?.suppressed === true) return "suppressed";

  const rows = Array.isArray(recipient?.consents)
    ? recipient.consents
    : recipient?.consent
      ? [recipient.consent]
      : [];

  // Distinct from every row being unusable: nothing is on file at all.
  if (rows.length === 0) return "no_consent";

  const states = rows.map((row) => stateForConsentRow(row, now, channel));
  // Never a default of "eligible" -- an unrecognised state falls through to the
  // end of the list and is reported rather than sent to.
  return CONSENT_PRECEDENCE.find((state) => states.includes(state)) || "no_consent";
}

// Split a recipient list into who may be sent to and who may not, with a reason
// each. Pure, so the split can be asserted without a mail server.
function partitionRecipients(recipients, { now = Date.now(), channel = "email" } = {}) {
  if (!Array.isArray(recipients)) {
    return { ok: false, code: "recipients_not_a_list", eligible: [], skipped: [] };
  }

  const eligible = [];
  const skipped = [];
  const seen = new Set();

  for (const recipient of recipients) {
    const address = normaliseAddress(recipient?.email);
    if (!address) {
      skipped.push({ recipient, reason: "no_address", detail: SKIP_REASONS.no_address });
      continue;
    }
    if (seen.has(address)) {
      // Counted, not dropped silently. A list with the same address three times
      // would otherwise be reported as three sends and billed as three.
      skipped.push({ recipient, reason: "duplicate", detail: SKIP_REASONS.duplicate });
      continue;
    }

    const state = consentState(recipient, now, { channel });
    if (state !== "eligible") {
      skipped.push({ recipient, reason: state, detail: SKIP_REASONS[state] });
      continue;
    }

    seen.add(address);
    eligible.push({ ...recipient, email: address });
  }

  return { ok: true, eligible, skipped };
}

// May this campaign go out?
//
// `approval` is the owner's, and its absence is the end of the decision. The
// classification is not re-derived here: lib/sonara-agent-authority.cjs owns
// that, and asking it twice in two places is how two answers start to disagree.
function authoriseCampaign({ approval = null, recipients = [], history = null, allowanceMinor = 0, now = Date.now(), channel = "email" } = {}) {
  // Owner approval first, before consent or credit, because it is the only one
  // of the three that no amount of correct data can substitute for.
  if (!approval || approval.status !== "approved") {
    return {
      allowed: false,
      code: "owner_approval_required",
      reason:
        "A customer campaign needs your approval before it can be sent. Nothing was sent and nothing was charged.",
      eligible: [],
      skipped: [],
      quote: null,
    };
  }
  if (!approval.approved_by) {
    // The same rule decideExecution applies to a proactive action: a row can
    // say "approved" without a person having approved it.
    return {
      allowed: false,
      code: "approval_missing_approver",
      reason: "The approval on file does not say who gave it.",
      eligible: [],
      skipped: [],
      quote: null,
    };
  }

  const split = partitionRecipients(recipients, { now, channel });
  if (!split.ok) {
    return { allowed: false, code: split.code, reason: "The recipient list could not be read.", eligible: [], skipped: [], quote: null };
  }

  if (split.eligible.length === 0) {
    // Distinct from "no credit" and from "not approved", because the owner's
    // next action is different again: this one is about their list.
    return {
      allowed: false,
      code: "no_consented_recipients",
      reason:
        `Nobody on this list of ${recipients.length} can be sent to. ` +
        "Nothing was sent and nothing was charged.",
      eligible: [],
      skipped: split.skipped,
      quote: null,
    };
  }

  // Billed on who is actually sent to, never on the list length. A list of 500
  // with 40 refusals is 460 emails, and charging for 500 would be charging for
  // the sends the consent rule prevented.
  const billableEmails = billableEmailCount(split.eligible.length);
  const decision = authoriseUsage({ capability: BILLED_CAPABILITY, units: billableEmails, history, allowanceMinor });

  if (!decision.allowed) {
    return {
      allowed: false,
      code: decision.code,
      reason: decision.reason,
      eligible: [],
      skipped: split.skipped,
      quote: decision.quote,
    };
  }

  return {
    allowed: true,
    code: "authorised",
    reason:
      `Sending to ${split.eligible.length} of ${recipients.length}` +
      `${split.skipped.length ? `, skipping ${split.skipped.length}` : ""}. ` +
      `${decision.quote.display}` +
      `${billableEmails > split.eligible.length ? ` (billed at the ${MINIMUM_BILLABLE_EMAILS}-email minimum)` : ""}.`,
    eligible: split.eligible,
    skipped: split.skipped,
    billableEmails,
    quote: decision.quote,
    drawMinor: decision.drawMinor,
    remainingMinor: decision.remainingMinor,
  };
}

module.exports = {
  BILLED_CAPABILITY,
  SENDABLE_CONSENT_STATUS,
  MINIMUM_BILLABLE_EMAILS,
  SKIP_REASONS,
  normaliseAddress,
  billableEmailCount,
  stateForConsentRow,
  CONSENT_PRECEDENCE,
  consentState,
  partitionRecipients,
  authoriseCampaign,
};
