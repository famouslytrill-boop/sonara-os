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
//   - A read that failed or came back at its limit is named, and the figures
//     that depend on it are withheld or marked "at least".
//   - The next step is a sentence for a person. Nothing here sends, pauses,
//     spends or publishes; AGENTS.md keeps customer campaigns behind the owner.

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
 */
function summarizeCampaign(reads = {}) {
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
    } else {
      target.netCents = target.valueCents - target.spendCents;
      target.returnRatio = target.netCents / target.spendCents;
      target.returnReason = truncated.includes("conversions") || truncated.includes("spend") ? "at_least" : null;
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

  const byCurrency = [...lines.values()].sort((a, b) => a.currency.localeCompare(b.currency));
  const summary = {
    ok: unreadable.length === 0,
    unreadable,
    truncated,
    unreadableRows,
    byCurrency,
    conversions,
    leads: { total: leadTotal, ...leads },
    sends
  };
  summary.nextStep = nextStep(summary);
  return summary;
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
  if (!anyActivity) return { key: "record_spend", text: "Nothing is recorded against this campaign yet. Record what it costs as you spend, so its return can be worked out." };
  if (!spent) return { key: "record_spend", text: "No spend is recorded for this campaign, so whether it paid for itself cannot be worked out. Record what it cost." };
  const measured = summary.byCurrency.filter((line) => line.returnRatio !== null);
  if (!measured.length) {
    return { key: "record_results", text: "This campaign has recorded spend and no results with a value against it. Record a conversion if one happened, or pause the campaign if nothing is coming of it." };
  }
  if (measured.some((line) => line.netCents < 0)) {
    return { key: "costs_more_than_it_returns", text: "On what is recorded, this campaign has returned less than it cost. Look at where its leads stall before spending more on it." };
  }
  return { key: "paying_for_itself", text: "On what is recorded, this campaign has returned more than it cost. Keep recording spend and results so that stays true as it grows." };
}

module.exports = { LEAD_STATES, SEND_STATES, parseAmountCents, majorToCents, summarizeCampaign, nextStep };
