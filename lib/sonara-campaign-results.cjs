// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// What a campaign cost, what came of it, and what to do next.
//
// Growth Studio could say who a campaign reached and which conversions were
// attributed to it, and could not say whether it paid for itself, because
// nothing recorded what it cost. growth_campaign_spend is that half, and this
// is the arithmetic over both halves. Pure: the route reads the rows and hands
// them here with their read outcomes; nothing in this file fetches.
//
// The rules, each a way a return figure is commonly wrong:
//
//   - Per currency, never across them. No exchange rate exists here.
//   - A return is only worked out where the campaign has both recorded spend
//     and at least one conversion with a value in that currency. Spend with no
//     valued conversion is "nothing recorded against it yet", not -100%: the
//     conversions may simply not have been recorded, and a figure that says
//     the money was lost is a definite claim on the strength of an absence.
//   - A conversion with no value counts as a conversion and adds nothing to the
//     value. It is reported, so the owner knows the figure is partial.
//   - A read that failed or came back at its limit is named, and the return
//     that depends on it is withheld. Not marked "at least": spend carries
//     negative corrections and a conversion's value may be negative, so a row
//     that was not read could move the return either way. It used to say "at
//     least" whenever either read was cut short, which on a cut-short spend
//     read overstated the return -- more spend means less of one.
//   - What the customers it brought in actually paid is a second basis, read
//     from their invoices (lib/sonara-campaign-payments.cjs). It is shown
//     beside the recorded results and never added to them, because the same
//     sale may be in both. Where it can be worked out, the next step rests on
//     it, since it is the one figure here nobody typed in.
//   - The next step is a sentence for a person. Nothing here sends, pauses,
//     spends or publishes; AGENTS.md keeps customer campaigns behind the owner.

const receipts = require("./sonara-email-delivery-receipts.cjs");
const campaignPayments = require("./sonara-campaign-payments.cjs");

const LEAD_STATES = Object.freeze(["new", "contacted", "qualified", "won", "lost", "archived"]);
const SEND_STATES = Object.freeze(["accepted", "failed", "not_attempted"]);

const currencyOf = (value) => {
  const code = String(value || "").trim().toLowerCase();
  return /^[a-z]{3}$/.test(code) ? code : null;
};

function integerCents(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && Number.isInteger(parsed) ? parsed : null;
}

// growth_conversions.value is numeric(18,4) in major units, as reported.
function majorToCents(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

/**
 * Parse a money amount typed into a form into integer cents. Accepts "12",
 * "12.5", "12.50" and, for a correction, a leading minus. Refuses anything
 * else rather than guessing -- "1,200" could be twelve hundred or one point
 * two, depending on who typed it.
 */
function parseAmountCents(text, { allowNegative = false } = {}) {
  const value = String(text ?? "").trim();
  const pattern = allowNegative ? /^-?\d{1,9}(?:\.\d{1,2})?$/ : /^\d{1,9}(?:\.\d{1,2})?$/;
  if (!pattern.test(value)) return null;
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = value.replace("-", "").split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return negative ? -cents : cents;
}

function emptyLine(currency) {
  return { currency, spendCents: 0, spendRows: 0, valueCents: 0, valuedConversions: 0, netCents: null, returnRatio: null, returnReason: null };
}

/**
 * @param {{ spend, conversions, leads, sends }} reads each { ok, rows, truncated? }
 *   Optional: deliveryEvents (a read), and paid -- { campaignId, customerLeads,
 *   invoices, payments, customersTruncated } for lib/sonara-campaign-payments.cjs,
 *   which takes this campaign's leads from `leads`.
 */
function summarizeCampaign(allReads = {}) {
  // The provider's receipts are not an input to the return or the next step's
  // money rules, so a receipt read that failed must not withhold them. The
  // table arrives in its own migration, and until that is applied every read of
  // it fails; folding it in here would have hidden every campaign's return for
  // that long. It is summarised on its own below, with its own unreadable state.
  // What the customers paid is kept apart for the same reason: a failed invoice
  // read says nothing about the recorded results, and must not withhold them.
  const { deliveryEvents, paid: paidReads, ...reads } = allReads;
  const unreadable = Object.entries(reads)
    .filter(([, result]) => !result || result.ok !== true)
    .map(([name]) => name);
  const truncated = Object.entries(reads)
    .filter(([, result]) => result?.ok === true && result.truncated === true)
    .map(([name]) => name);

  const lines = new Map();
  const line = (currency) => {
    if (!lines.has(currency)) lines.set(currency, emptyLine(currency));
    return lines.get(currency);
  };
  const unreadableRows = { spend: 0, conversions: 0 };

  if (reads.spend?.ok) {
    for (const row of reads.spend.rows) {
      const cents = integerCents(row?.amount_cents);
      const currency = currencyOf(row?.currency);
      if (cents === null || !currency) { unreadableRows.spend += 1; continue; }
      const target = line(currency);
      target.spendCents += cents;
      target.spendRows += 1;
    }
  }

  const conversions = { total: 0, withoutValue: 0, byConfidence: {} };
  if (reads.conversions?.ok) {
    for (const row of reads.conversions.rows) {
      conversions.total += 1;
      const confidence = String(row?.attribution_confidence || "unknown");
      conversions.byConfidence[confidence] = (conversions.byConfidence[confidence] || 0) + 1;
      const cents = majorToCents(row?.value);
      if (cents === null) { conversions.withoutValue += 1; continue; }
      const currency = currencyOf(row?.currency);
      if (!currency) { unreadableRows.conversions += 1; continue; }
      const target = line(currency);
      target.valueCents += cents;
      target.valuedConversions += 1;
    }
  }

  for (const target of lines.values()) {
    const spendKnown = reads.spend?.ok === true;
    const valueKnown = reads.conversions?.ok === true;
    if (!spendKnown || !valueKnown) {
      target.returnReason = "not_readable";
    } else if (target.spendCents <= 0) {
      target.returnReason = "no_spend_recorded";
    } else if (target.valuedConversions === 0) {
      target.returnReason = "no_valued_conversions";
    } else if (truncated.includes("conversions") || truncated.includes("spend")) {
      target.returnReason = "incomplete";
    } else {
      target.netCents = target.valueCents - target.spendCents;
      target.returnRatio = target.netCents / target.spendCents;
    }
  }

  const leads = Object.fromEntries(LEAD_STATES.map((state) => [state, 0]));
  let leadTotal = 0;
  if (reads.leads?.ok) {
    for (const row of reads.leads.rows) {
      leadTotal += 1;
      const state = LEAD_STATES.includes(row?.status) ? row.status : "new";
      leads[state] += 1;
    }
  }

  const sends = Object.fromEntries(SEND_STATES.map((state) => [state, 0]));
  if (reads.sends?.ok) {
    for (const row of reads.sends.rows) {
      if (SEND_STATES.includes(row?.status)) sends[row.status] += 1;
    }
  }

  // What happened after the provider accepted each email, when the caller read
  // the receipts. Null when it did not: "no receipts" and "receipts not read"
  // are different statements, and only the caller knows which applies.
  const delivery = !deliveryEvents ? null
    : deliveryEvents.ok === true && reads.sends?.ok === true
      ? receipts.summarizeDelivery({ sends: reads.sends, events: deliveryEvents })
      : { unreadable: true };

  const byCurrency = [...lines.values()].sort((a, b) => a.currency.localeCompare(b.currency));

  // What the customers it brought in paid, beside what was spent, per currency.
  // Null when the caller did not read it, for the same reason as delivery.
  const paid = !paidReads ? null : campaignPayments.summarizeCampaignPayments({ ...paidReads, leads: reads.leads });
  if (paid && !paid.unreadable) {
    paid.byCurrency = paidLines(paid, byCurrency, { spendKnown: reads.spend?.ok === true, spendCut: truncated.includes("spend") });
  }

  const summary = {
    ok: unreadable.length === 0,
    unreadable,
    truncated,
    unreadableRows,
    byCurrency,
    conversions,
    leads: { total: leadTotal, ...leads },
    sends,
    delivery,
    paid
  };
  summary.nextStep = nextStep(summary);
  return summary;
}

// Each currency the customers paid in or the campaign spent in, with the return
// on what they paid where both are known. The same rules as the recorded
// return, and one more: a currency with spend and no payment yet is "nothing
// paid yet", not -100%, because the invoices may simply not be due.
function paidLines(paid, spendLines, { spendKnown, spendCut }) {
  const blank = (currency) => ({ currency, receivedCents: 0, payments: 0, outstandingCents: 0, openInvoices: 0 });
  const merged = new Map(paid.byCurrency.map((entry) => [entry.currency, { ...entry, spendCents: 0 }]));
  for (const spent of spendLines) {
    if (!spent.spendRows) continue;
    if (!merged.has(spent.currency)) merged.set(spent.currency, { ...blank(spent.currency), spendCents: 0 });
    merged.get(spent.currency).spendCents = spent.spendCents;
  }
  for (const entry of merged.values()) {
    entry.netCents = null;
    entry.returnRatio = null;
    if (!spendKnown) entry.returnReason = "not_readable";
    else if (spendCut || paid.truncated) entry.returnReason = "incomplete";
    else if (entry.spendCents <= 0) entry.returnReason = "no_spend_recorded";
    else if (entry.payments === 0) entry.returnReason = "no_payments_yet";
    else {
      entry.returnReason = null;
      entry.netCents = entry.receivedCents - entry.spendCents;
      entry.returnRatio = entry.netCents / entry.spendCents;
    }
  }
  return [...merged.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}

// The money rules on what the customers paid, or null to fall back to the
// recorded results. A loss is named before a gain, as on the recorded basis.
function paidStep(paid) {
  if (!paid || paid.unreadable) return null;
  const measured = paid.byCurrency.filter((entry) => entry.returnRatio !== null);
  if (!measured.length) return null;
  const losing = measured.filter((entry) => entry.netCents < 0);
  if (losing.length) {
    const unpaid = losing.reduce((total, entry) => total + entry.openInvoices, 0);
    if (unpaid > 0) {
      return { key: "collect_unpaid", basis: "payments", text: `So far the customers this campaign brought in have paid less than it cost, and ${unpaid} of their ${unpaid === 1 ? "invoices is" : "invoices are"} still unpaid. Collect ${unpaid === 1 ? "that" : "those"} before judging the campaign.` };
    }
    return { key: "costs_more_than_it_returns", basis: "payments", text: "On what the customers it brought in have paid, this campaign has returned less than it cost. Look at where its leads stall before spending more on it." };
  }
  return { key: "paying_for_itself", basis: "payments", text: "On what the customers it brought in have paid, this campaign has paid for itself. Keep recording what it costs so that stays true as it grows." };
}

// One sentence, chosen by the first rule that applies. Ordered by what an owner
// can do something about soonest: people waiting to hear back before money.
function nextStep(summary) {
  if (!summary.ok) return { key: "unreadable", text: "Some of this campaign's records could not be read, so no suggestion is made. Try again shortly." };
  const spent = summary.byCurrency.some((line) => line.spendCents > 0);
  const anyActivity = spent || summary.sends.accepted + summary.sends.failed > 0 || summary.leads.total > 0 || summary.conversions.total > 0;
  if (summary.leads.new > 0) {
    return { key: "contact_new_leads", text: `${summary.leads.new} ${summary.leads.new === 1 ? "person who" : "people who"} came in through this campaign ${summary.leads.new === 1 ? "has" : "have"} not been contacted yet.` };
  }
  if (summary.sends.failed > 0) {
    return { key: "review_failed_sends", text: `${summary.sends.failed} ${summary.sends.failed === 1 ? "email was" : "emails were"} refused when sent. Check the addresses before sending again.` };
  }
  // A spam complaint before a bounce: it is about what was sent, and the next
  // campaign repeats it unless somebody reads it first.
  const delivery = summary.delivery;
  if (delivery && !delivery.unreadable && delivery.complained > 0) {
    return { key: "spam_complaints", text: `${delivery.complained} ${delivery.complained === 1 ? "person" : "people"} marked this campaign as spam. The provider stops mailing them; read what was sent before the next campaign goes out.` };
  }
  if (delivery && !delivery.unreadable && delivery.permanentBounces > 0) {
    return { key: "remove_bounced", text: `${delivery.permanentBounces} ${delivery.permanentBounces === 1 ? "email" : "emails"} bounced permanently. Correct or remove those addresses; the provider will not deliver to them again.` };
  }
  if (!anyActivity) return { key: "record_spend", text: "Nothing is recorded against this campaign yet. Record what it costs as you spend, so its return can be worked out." };
  if (!spent) return { key: "record_spend", text: "No spend is recorded for this campaign, so whether it paid for itself cannot be worked out. Record what it cost." };
  // What its customers actually paid comes first where it can be worked out.
  const fromPayments = paidStep(summary.paid);
  if (fromPayments) return fromPayments;
  const measured = summary.byCurrency.filter((line) => line.returnRatio !== null);
  if (!measured.length) {
    if (summary.byCurrency.some((line) => line.returnReason === "incomplete")) {
      return { key: "too_many_records", text: "This campaign has more records than can be read at once, so whether it paid for itself is not worked out here." };
    }
    return { key: "record_results", text: "This campaign has recorded spend and no results with a value against it. Record a conversion if one happened, or pause the campaign if nothing is coming of it." };
  }
  if (measured.some((line) => line.netCents < 0)) {
    return { key: "costs_more_than_it_returns", basis: "recorded", text: "On what is recorded, this campaign has returned less than it cost. Look at where its leads stall before spending more on it." };
  }
  return { key: "paying_for_itself", basis: "recorded", text: "On what is recorded, this campaign has paid for itself. Keep recording spend and results so that stays true as it grows." };
}

module.exports = { LEAD_STATES, SEND_STATES, parseAmountCents, majorToCents, summarizeCampaign, nextStep };
