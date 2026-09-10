"use strict";

// What an inbound text message MEANS, when what it means is "stop".
//
// SMS opt-out is a legal obligation on any outbound text and it is ours rather
// than the carrier's to get right. This file is the half of it that does not
// need a vendor: turning the words somebody replied into an intent.
//
// ## What already existed, so this is not confused with more than it is
//
// The refusal side is built and tested. `growth_contact_consents` records
// permission per channel, `consentState` in `lib/growth-studio-sender.cjs`
// returns `consent_revoked` for a row carrying `withdrawn_at`, and
// `authoriseOutbound` in `lib/sonara-telephony.cjs` refuses on that code before
// spending anything. **A recorded opt-out already blocks every outbound text.**
//
// What was missing is upstream of that: nothing could turn "STOP" into the row.
// An owner could withdraw a consent from a form; the person holding the phone
// could not, and they are the only one whose decision it is. That is the same
// gap the email unsubscribe path closed in
// `routes/growth-studio-unsubscribe-routes.cjs`, one channel over.
//
// ## Why the keyword list is a union of two vendors' lists
//
// Both candidate carriers recognise these keywords themselves and maintain
// their own opt-out list. Read 10 September 2026:
//
//   * Twilio, twilio.com/docs/messaging/tutorials/advanced-opt-out: "By
//     default, Twilio handles standard English-language reply messages -- STOP,
//     UNSUBSCRIBE, END, QUIT, STOPALL, REVOKE, OPTOUT, and CANCEL -- for long
//     code numbers". A later send to an opted-out number "will fail with Error
//     Code 21610 asynchronously".
//   * Telnyx, support.telnyx.com/en/articles/1270091: stop words are "stop,
//     stopall, stop all, unsubscribe, cancel, end, quit", and "When Telnyx
//     identifies a stop word, the person's phone number is added to the opt-out
//     list and you will no longer be able to send messages to that number."
//
// The two lists are not the same. `REVOKE` and `OPTOUT` are Twilio's and not
// Telnyx's; `stop all` with a space is Telnyx's and not Twilio's. So this
// recognises the **union**: the set a customer's contacts can rely on must not
// narrow the day the owner changes carrier, and a keyword one vendor honours is
// a keyword somebody has been told works.
//
// That the vendor also enforces it does not make our record redundant, for two
// reasons that are about different failures:
//
//   * **The vendor's list does not survive the vendor.** Porting numbers is the
//     hardest-to-reverse decision in
//     `docs/architecture/2026-09-10-CARRIER-VENDOR-COMPARISON.md`, and an
//     opt-out list held only at a carrier is unverifiable on the way out.
//   * **The vendor refuses after we have paid.** Twilio's block is a 21610 on a
//     message we already submitted. `authoriseOutbound` refuses before the API
//     call, which is the difference between honouring an opt-out and being
//     stopped from violating one.
//
// ## The keyword that is deliberately NOT an opt-in
//
// Twilio's page, verbatim: "Only the keywords START and UNSTOP can fully undo
// the blocking. Twilio's supported keyword 'YES' will not work to opt-in a
// previously unsubscribed user."
//
// So honouring `YES` here would write a granted row while the carrier still
// blocked the number -- our record saying reachable, the network saying no. That
// is the defect this codebase is named for, in a place where the visible symptom
// would be an owner watching texts silently not arrive. `YES` is listed as
// recognised-and-refused rather than left out, so the next person meets the
// reason instead of the omission.

// Case-insensitive, per Twilio: "Twilio matches keywords in a case-insensitive
// way. 'Stop' will be handled the same way as 'STOP' or 'stop'." Stored lower
// case; `normaliseInbound` lowers the message.
const OPT_OUT_KEYWORDS = Object.freeze([
  "stop",
  "stopall",
  "stop all",
  "unsubscribe",
  "cancel",
  "end",
  "quit",
  "revoke",
  "optout",
  "opt out"
]);

// Both vendors: "start, unstop". Twilio adds that these are the only two that
// fully undo blocking, which is why nothing else is here.
const OPT_IN_KEYWORDS = Object.freeze(["start", "unstop"]);

// Twilio: "the keyword 'help' is reserved and cannot be removed." `info` is
// named on the same page as the other example.
const HELP_KEYWORDS = Object.freeze(["help", "info"]);

// Recognised, and deliberately not honoured. See the note above.
const REFUSED_OPT_IN_KEYWORDS = Object.freeze(["yes"]);

// A reply is an opt-out when the whole message is the keyword, not when the
// message contains it.
//
// "Please stop by at four" is not an opt-out, and treating it as one costs a
// customer a customer -- silently, because the owner's next text simply never
// arrives and the refusal is a code in a log. Substring matching is the obvious
// implementation and it is wrong in the expensive direction.
//
// So: trim, normalise Unicode compatibility forms, drop surrounding punctuation
// and quotes, collapse inner whitespace, lower case -- then compare whole
// strings. "STOP." and " stop " and "Stop" all match; "stop by" does not.
function normaliseInbound(body) {
  if (body === null || body === undefined) return null;
  const text = String(body);
  if (text.trim() === "") return null;
  return text
    .normalize("NFKC")
    // Zero-width characters survive NFKC and would break an exact compare while
    // being invisible to whoever pasted them.
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .toLowerCase()
    .replace(/^[\s"'`.,!?:;()[\]{}\-–—*_]+/, "")
    .replace(/[\s"'`.,!?:;()[\]{}\-–—*_]+$/, "")
    .replace(/\s+/g, " ")
    .trim() || null;
}

// What the message asks for. Four outcomes, and `none` is one of them: most
// inbound texts are a person replying to a human, and reading those as commands
// is how a conversation becomes an opt-out.
function classifyInbound({ body } = {}) {
  const matched = normaliseInbound(body);
  if (matched === null) {
    return {
      action: "none",
      keyword: null,
      matched: null,
      reason: "The message was empty, so it asks for nothing."
    };
  }

  if (OPT_OUT_KEYWORDS.includes(matched)) {
    return {
      action: "opt_out",
      keyword: matched,
      matched,
      // Scoped by channel and NOT by purpose, the same as the email path. A
      // person who said stop did not say stop about one campaign type.
      scope: "every purpose on the sms channel",
      reason: `"${matched}" is an opt-out keyword on both candidate carriers' documented lists.`
    };
  }

  if (OPT_IN_KEYWORDS.includes(matched)) {
    return {
      action: "opt_in",
      keyword: matched,
      matched,
      reason: `"${matched}" is one of the two keywords that fully undo carrier blocking.`
    };
  }

  if (HELP_KEYWORDS.includes(matched)) {
    return {
      action: "help",
      keyword: matched,
      matched,
      reason: `"${matched}" requires a reply saying who is texting and how to stop.`
    };
  }

  if (REFUSED_OPT_IN_KEYWORDS.includes(matched)) {
    return {
      action: "none",
      keyword: matched,
      matched,
      // Not an error and not an opt-in. Recording a permission here would make
      // our record disagree with the carrier's block.
      reason: `"${matched}" does not undo carrier blocking, so recording it as permission would say reachable while the network refuses.`
    };
  }

  return {
    action: "none",
    keyword: null,
    matched,
    reason: "The message is not a keyword, so it is a message."
  };
}

// Whether WE owe the person a confirmation text, which is a vendor-configuration
// question and is returned as one rather than answered here.
//
// Both vendors reply automatically by default. Telnyx: "Telnyx will detect this
// and automatically send out a generic unsubscribed message from the number that
// received the opt out message." Twilio's Advanced Opt-Out exists precisely to
// customise or replace that.
//
// So sending our own confirmation on top of the vendor's default sends the
// person two texts about stopping texts, and sending none when the vendor's
// default has been turned off leaves an obligation unmet. The answer depends on
// a setting in an account nobody has opened yet, so this reports what it depends
// on instead of picking. Guessing either way writes a wrong reason into the one
// place somebody would read instead of checking.
function confirmationOwedBy({ vendorAutoResponseEnabled = null } = {}) {
  if (vendorAutoResponseEnabled === true) {
    return {
      owedByUs: false,
      reason: "The carrier sends its own confirmation, and a second one would be two texts about stopping texts."
    };
  }
  if (vendorAutoResponseEnabled === false) {
    return {
      owedByUs: true,
      reason: "The carrier's automatic response is off, so the confirmation is ours to send."
    };
  }
  // Three states, not two: unknown is not off.
  return {
    owedByUs: null,
    reason: "Nobody has recorded whether the carrier's automatic response is on, and it decides this. Not a default to pick in code."
  };
}

module.exports = {
  OPT_OUT_KEYWORDS,
  OPT_IN_KEYWORDS,
  HELP_KEYWORDS,
  REFUSED_OPT_IN_KEYWORDS,
  normaliseInbound,
  classifyInbound,
  confirmationOwedBy,
};
