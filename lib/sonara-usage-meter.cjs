"use strict";

// Whether a metered capability may run, and what it costs when it does.
//
// `lib/sonara-paid-capabilities.cjs` prices six things that cost real money per
// use, each against a dated cost floor, and the release chain fails if a price
// drops below its floor. It is a complete price list and it charges nobody: for
// four months it has been required by exactly two files -- its own release check
// and its own test.
//
// This is the missing half. Nothing here invents a price; `quote()` remains the
// only place a number comes from. What this adds is the decision: does this
// organization have the credit to run this, and what is drawn down when it does.
//
// ## Why this is the keystone rather than one feature among three
//
// The three capability gaps against competitors -- inbound carrier calls,
// carrier SMS, and outbound email sending -- are the same shape: a metered
// outbound channel with a per-use vendor bill. Added without a meter, each is a
// cost centre on a product whose advantage is zero marginal cost, and the free
// tier pays for strangers' phone calls. Added on top of a meter, each is a
// margin line: `quote()` already returns `marginMinor`, and telephony prices at
// 3 minor units against a 0.8 floor.
//
// So this is built first deliberately. It is what makes the other three safe to
// build rather than ruinous.
//
// ## Fail CLOSED, and this is the opposite of the agent breaker
//
// lib/sonara-agent-authority.cjs fails OPEN when it cannot read an agent's
// history, because blocking every agent on a transient database error is the
// worse outage. The trade here is genuinely reversed, and the reason is worth
// stating rather than leaving to look like an inconsistency:
//
//   * A refused generation is retryable. The customer waits and tries again.
//   * A GPU second, an SMS or a carrier minute spent is money gone. It cannot
//     be un-spent, and it is not honest to bill a customer afterwards for
//     something we told them we would run.
//
// An unreadable balance is therefore a refusal here. The asymmetry is the whole
// argument: one direction loses a retry, the other loses cash.

const { CAPABILITIES, quote, toMoney } = require("./sonara-paid-capabilities.cjs");

// The ledger is append-only and the balance is its sum. That is a serverless
// decision, not a stylistic one: two functions reading a `balance` column,
// subtracting, and writing it back will lose one of the two writes under any
// concurrency at all, and the symptom is free usage rather than an error. Rows
// that only ever get inserted cannot race.
const LEDGER_TABLE = "usage_credit_ledger";

// Every entry is one of these, and the sign is not the caller's to choose --
// a "grant" that debits or a "draw" that credits would be a silent accounting
// error, so direction is derived from the kind.
const ENTRY_KINDS = Object.freeze({
  grant: Object.freeze({ direction: 1, label: "Credit added" }),
  draw: Object.freeze({ direction: -1, label: "Usage charged" }),
  refund: Object.freeze({ direction: 1, label: "Usage refunded" }),
  adjustment: Object.freeze({ direction: 1, label: "Owner adjustment" }),
});

function isMeteredCapability(capability) {
  return Object.prototype.hasOwnProperty.call(CAPABILITIES, capability);
}

// Sum an append-only ledger into a balance.
//
// `history` carries its own outcome -- {ok, rows} -- for the same reason the
// agent breaker's does: a failed read and an empty ledger are different facts,
// and an empty array standing for both would read as "no credit" in one place
// and "read failed" in another. Here they happen to lead to the same refusal,
// but for different reasons the customer needs told apart: "you have no credit,
// add some" against "we could not check, try again".
function balanceFrom(history) {
  if (!history || history.ok !== true || !Array.isArray(history.rows)) {
    return { ok: false, code: "balance_unreadable", balanceMinor: null };
  }

  let total = 0;
  for (const row of history.rows) {
    const kind = ENTRY_KINDS[String(row?.entry_kind || "")];
    // An unrecognised entry kind is not skipped. Skipping it would compute a
    // balance that looks authoritative while ignoring rows, which is the shape
    // of every silent-overcharge bug: the number is wrong and nothing says so.
    if (!kind) return { ok: false, code: "unknown_entry_kind", balanceMinor: null, detail: String(row?.entry_kind || "(empty)") };

    // `Number(null)` is 0 and `Number("")` is 0, and both are finite, so a
    // `Number.isFinite` check alone reads a missing amount as a zero-value
    // entry and sums it happily. That is defect four in
    // .claude/skills/checks-that-cannot-lie -- absent read as zero -- and it is
    // the shape that once made unpriced services read as free across
    // twenty-three columns here. It was in the first draft of this function and
    // the test below caught it, which is the only reason it is not in the
    // ledger.
    //
    // The guard is finiteNumber's, from lib/sonara-goal-science.cjs: reject
    // null, undefined and empty string BEFORE coercing.
    const raw = row?.amount_minor;
    const amount = raw === null || raw === undefined || raw === "" ? null : Number(raw);
    if (amount === null || !Number.isFinite(amount) || amount < 0) {
      return { ok: false, code: "bad_ledger_amount", balanceMinor: null, detail: String(raw) };
    }
    total += kind.direction * amount;
  }

  return { ok: true, balanceMinor: total };
}

// May this run, and what does it draw?
//
// Returns the quote alongside the decision so a caller can show the customer
// the number before it is spent. A page that says "not enough credit" without
// saying how much this would have cost is asking somebody to guess.
function authoriseUsage({ capability, units, history, idempotencyKey = null } = {}) {
  if (!isMeteredCapability(capability)) {
    // Deliberately not "allowed". A capability with no price is not free -- it
    // is unpriced, and the two are only the same if somebody has decided so on
    // purpose. sonara-paid-capabilities.cjs says the same thing in quote().
    return {
      allowed: false,
      code: "unknown_capability",
      reason: `${capability} has no price, so what it costs is unknown rather than nothing. Add it to CAPABILITIES first.`,
      quote: null,
      balanceMinor: null,
    };
  }

  const priced = quote(capability, units);
  if (!priced.ok) {
    return { allowed: false, code: priced.code, reason: priced.detail, quote: null, balanceMinor: null };
  }

  const balance = balanceFrom(history);
  if (!balance.ok) {
    return {
      allowed: false,
      code: balance.code,
      reason:
        balance.code === "balance_unreadable"
          ? "Your credit balance could not be read just now, so this was not run rather than run unpaid. Try again."
          : `The credit ledger holds an entry this cannot read (${balance.detail}), so no balance was calculated and nothing was charged.`,
      quote: priced,
      balanceMinor: null,
    };
  }

  // Zero usage is allowed and draws nothing. quote() already treats "usage of
  // zero" and "no usage supplied" as different answers, and this keeps that
  // distinction rather than collapsing them: a job that legitimately consumed
  // nothing should not be refused for having no credit.
  if (priced.chargeMinor === 0) {
    return {
      allowed: true,
      code: "no_charge",
      reason: `${priced.units} ${priced.unit} costs nothing, so nothing was drawn.`,
      quote: priced,
      balanceMinor: balance.balanceMinor,
      drawMinor: 0,
      idempotencyKey,
    };
  }

  if (balance.balanceMinor < priced.chargeMinor) {
    return {
      allowed: false,
      code: "insufficient_credit",
      reason:
        `This needs ${toMoney(priced.chargeMinor).toFixed(2)} of credit and ${toMoney(Math.max(0, balance.balanceMinor)).toFixed(2)} is available. ` +
        "Nothing was run and nothing was charged.",
      quote: priced,
      balanceMinor: balance.balanceMinor,
    };
  }

  return {
    allowed: true,
    code: "authorised",
    reason: `${priced.display} drawn from a balance of ${toMoney(balance.balanceMinor).toFixed(2)}.`,
    quote: priced,
    balanceMinor: balance.balanceMinor,
    drawMinor: priced.chargeMinor,
    remainingMinor: balance.balanceMinor - priced.chargeMinor,
    idempotencyKey,
  };
}

// The row to append once the work actually happened.
//
// Separate from authorising on purpose. Authorising and charging at the same
// moment charges for work that may then fail, and refunding it afterwards means
// the ledger has to be right twice. This is called with what was really used,
// which may be less than was authorised -- a video that failed at second three
// of a hundred should draw three.
function drawEntry({ capability, units, organizationId, idempotencyKey, actorUserId = null }) {
  if (!organizationId) {
    // Loud rather than a row with a null tenant. The same rule
    // sonara-agent-action-log.cjs enforces: a ledger entry belonging to nobody
    // is money nobody is charged for that every organization's query misses.
    throw new TypeError("a usage ledger entry requires an organizationId");
  }
  if (!idempotencyKey) {
    // Without this, one retried job draws twice. A meter that overcharges on a
    // network retry is worse than no meter, because the customer cannot see it
    // happening and we cannot tell it from real usage.
    throw new TypeError("a usage ledger entry requires an idempotencyKey, or a retry charges twice");
  }

  const priced = quote(capability, units);
  if (!priced.ok) return { ok: false, code: priced.code, detail: priced.detail };

  return {
    ok: true,
    row: {
      organization_id: organizationId,
      actor_user_id: actorUserId,
      entry_kind: "draw",
      capability,
      unit: priced.unit,
      units: priced.units,
      amount_minor: priced.chargeMinor,
      cost_minor: priced.costMinor,
      margin_minor: priced.marginMinor,
      idempotency_key: String(idempotencyKey),
    },
  };
}

module.exports = {
  LEDGER_TABLE,
  ENTRY_KINDS,
  isMeteredCapability,
  balanceFrom,
  authoriseUsage,
  drawEntry,
};
