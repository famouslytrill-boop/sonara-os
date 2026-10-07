// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// One campaign's page: what it cost, what came of it, whether it paid for
// itself, and what to do next. The arithmetic is lib/sonara-campaign-results.cjs;
// this renders what that returns and adds nothing to it.

const PROBLEMS = Object.freeze({
  amount_invalid: "Enter the amount as a number, like 120 or 120.50. A correction may start with a minus sign.",
  currency_invalid: "Enter the currency as three letters, like usd or gbp.",
  date_invalid: "Enter the date the money was spent. It cannot be in the future.",
  description_required: "Say what the money paid for.",
  not_found: "That campaign is not in this workspace.",
  not_saved: "That could not be saved just now. Nothing was recorded."
});

const DONE = Object.freeze({ spend: "Recorded." });

const { campaignLink } = require("./sonara-campaign-links.cjs");
const { encode: encodeQr } = require("./sonara-qr.cjs");
const { toSvg: qrToSvg } = require("./sonara-qr-png.cjs");

const money = (cents, currency) => `${String(currency || "").toUpperCase()} ${(Number(cents) / 100).toFixed(2)}`;
const words = (value) => String(value || "").replaceAll("_", " ");

function notice(query = {}, escape) {
  const problem = PROBLEMS[String(query.problem || "")];
  const done = DONE[String(query.done || "")];
  if (problem) return `<article class="card" role="alert"><h2>Not recorded</h2><p>${escape(problem)}</p></article>`;
  if (query.problem) return `<article class="card" role="alert"><h2>Not recorded</h2><p>${escape(PROBLEMS.not_saved)}</p></article>`;
  if (done) return `<article class="card" role="status"><h2>Saved</h2><p>${escape(done)}</p></article>`;
  return "";
}

function unreadableCard(summary, escape) {
  const names = { spend: "what it cost", conversions: "its results", leads: "the people it brought in", sends: "who it was sent to" };
  const list = summary.unreadable.map((key) => names[key] || key).join(", ");
  return `<article class="card" role="alert"><h2>We could not read everything</h2><p>${escape(`We could not read ${list} just now, so no return is worked out. This is not the same as there being nothing.`)}</p></article>`;
}

const RETURN_REASONS = Object.freeze({
  no_spend_recorded: "No spend recorded in this currency.",
  no_valued_conversions: "Spend is recorded, and no result with a value yet.",
  not_readable: "Could not be read."
});

function returnCard(summary, escape) {
  const lines = summary.byCurrency;
  const body = lines.length
    ? `<table><thead><tr><th>Currency</th><th>Spent</th><th>Value of recorded results</th><th>Difference</th><th>Return on what was spent</th></tr></thead><tbody>${lines.map((line) => {
      const outcome = line.returnRatio === null
        ? RETURN_REASONS[line.returnReason] || "Not enough recorded."
        : `${line.returnReason === "at_least" ? "At least " : ""}${Math.round(line.returnRatio * 100)}%`;
      return `<tr><td>${escape(line.currency.toUpperCase())}</td><td>${escape(money(line.spendCents, line.currency))}</td><td>${escape(money(line.valueCents, line.currency))} (${line.valuedConversions})</td><td>${escape(line.netCents === null ? "Not worked out" : money(line.netCents, line.currency))}</td><td>${escape(outcome)}</td></tr>`;
    }).join("")}</tbody></table>`
    : "<p>Nothing spent or earned is recorded against this campaign yet.</p>";
  const notes = [
    "Spend is what you recorded here. Results are the conversions recorded against this campaign. Neither is read from an ad platform.",
    lines.length > 1 ? "Each currency is worked out on its own. They are not added together, because no exchange rate is applied here." : "",
    summary.conversions.withoutValue ? `${summary.conversions.withoutValue} conversion(s) have no value recorded, so they are counted but add nothing to the value.` : "",
    summary.truncated.length ? "There were more records than we read at once, so the figures are at least what is shown." : ""
  ].filter(Boolean).map((text) => `<p class="fine">${escape(text)}</p>`).join("");
  return `<article class="card"><h2>Did it pay for itself</h2>${body}${notes}</article>`;
}

function nextStepCard(summary, escape) {
  return `<article class="card"><h2>What to do next</h2><p>${escape(summary.nextStep.text)}</p><p class="fine">A suggestion from the records above. Nothing is sent, paused or spent on your behalf.</p></article>`;
}

function activityCard(summary) {
  const l = summary.leads;
  const s = summary.sends;
  return `<article class="card"><h2>What came of it</h2><table><tbody><tr><td>People who came in through it</td><td>${l.total}</td></tr><tr><td>Not contacted yet</td><td>${l.new}</td></tr><tr><td>Became customers</td><td>${l.won}</td></tr><tr><td>Emails delivered to the provider</td><td>${s.accepted}</td></tr><tr><td>Emails refused</td><td>${s.failed}</td></tr><tr><td>Conversions recorded</td><td>${summary.conversions.total}</td></tr></tbody></table></article>`;
}

// What the provider reported after accepting the emails. Counted per email, and
// stated against the emails it can report on, which is not always all of them.
function deliveryCard(summary) {
  const d = summary.delivery;
  const accepted = summary.sends.accepted;
  if (!d || accepted === 0) return "";
  if (d.unreadable) {
    return `<article class="card"><h2>What happened to the emails</h2><p>The provider's reports on these emails could not be read just now. This is not the same as there being none.</p></article>`;
  }
  if (d.trackable === 0) {
    return `<article class="card"><h2>What happened to the emails</h2><p>The provider has not reported on these emails: none of them was sent with an id it can report against. "Delivered to the provider" above is as far as this campaign's record goes.</p></article>`;
  }
  const row = (label, value) => `<tr><td>${label}</td><td>${value}</td></tr>`;
  const bounced = d.bounced ? `${d.bounced}${d.permanentBounces ? ` (${d.permanentBounces} permanently)` : ""}` : "0";
  const of = d.trackable === accepted ? `all ${d.trackable}` : `${d.trackable} of the ${accepted}`;
  return `<article class="card"><h2>What happened to the emails</h2><p class="fine">As reported by the email provider, for ${of} emails it accepted that it can report on.${d.truncated ? " Showing at least these numbers: there were more reports than this page reads." : ""}</p><table><tbody>${row("Reached the inbox server", d.delivered)}${row("Delayed, still being tried", d.delivery_delayed)}${row("Bounced", bounced)}${row("Marked as spam", d.complained)}${row("Opened", d.opened)}${row("A link was followed", d.clicked)}${row("Could not be sent", d.failed)}</tbody></table><p class="fine">Opens are only reported when open tracking is switched on with the provider, and many mail apps block it, so a low number is not a count of who read the email.</p></article>`;
}

// Where people from this campaign can enquire, with the link that credits
// their enquiry to it (lib/sonara-campaign-links.cjs). Emails sent from the
// campaign tag the link themselves; this is for everywhere else -- a flyer, a
// post, a message -- and the code is the same link for print.
function campaignLinkCard({ campaign, chatPage, origin, escape }) {
  const title = "<h2>Link people to this campaign</h2>";
  if (!chatPage.ok) {
    return `<article class="card">${title}<p>Your chat page could not be read just now, so no link is shown. Try again shortly.</p></article>`;
  }
  const page = chatPage.rows[0];
  if (!page || page.enabled !== true) {
    return `<article class="card">${title}<p>Enquiries from this campaign are credited to it when people reach you through your chat page, and ${page ? "yours is switched off" : "you do not have one yet"}.</p><p><a class="action" href="/growth-studio/owner/chat-widget">${page ? "Switch on your chat page" : "Set up your chat page"}</a></p></article>`;
  }
  const link = campaignLink({ origin, slug: page.slug, campaignId: campaign.id });
  if (!link) {
    return `<article class="card">${title}<p>This site's https address is not known here, so a link that would work for other people cannot be shown.</p></article>`;
  }
  const qr = encodeQr(link, { ecc: "M" });
  const code = qr.ok ? `<div class="sonara-qr">${qrToSvg(qr.modules)}</div>` : "";
  return `<article class="card">${title}<p><code>${escape(link)}</code></p>${code}<p class="fine">Emails sent from this campaign already use this link wherever they mention your chat page. Use it anywhere else -- a flyer, a post, a message -- and an enquiry that comes through it is counted under "People who came in through it".</p></article>`;
}

function spendCard(spendRows, { action, defaultCurrency, today, escape }) {
  const list = spendRows.ok === false
    ? "<p>We could not read what this campaign has cost just now.</p>"
    : spendRows.rows.length
      ? `<table><thead><tr><th>Date</th><th>What it paid for</th><th>Amount</th><th>Reference</th></tr></thead><tbody>${spendRows.rows.map((row) => `<tr><td>${escape(String(row.spent_on || ""))}</td><td>${escape(row.description || "")}${row.kind === "correction" ? " (correction)" : ""}</td><td>${escape(money(row.amount_cents, row.currency))}</td><td>${escape(row.reference || "")}</td></tr>`).join("")}</tbody></table>`
      : "<p>Nothing recorded yet.</p>";
  return `<article class="card"><h2>What it cost</h2>${list}<form method="post" action="${escape(action)}"><label>Kind<select name="kind"><option value="spend">Money spent</option><option value="correction">Correction to an earlier amount</option></select></label><label>Amount<input name="amount" required inputmode="decimal" maxlength="13" placeholder="120.00"></label><label>Currency<input name="currency" required maxlength="3" value="${escape(defaultCurrency)}"></label><label>Date spent<input name="spent_on" type="date" required max="${escape(today)}" value="${escape(today)}"></label><label>What it paid for<input name="description" required maxlength="300"></label><label>Reference (optional)<input name="reference" maxlength="200"></label><p class="fine">Recorded amounts are kept as they were entered. To fix a mistake, add a correction rather than changing the original.</p><button type="submit">Record</button></form></article>`;
}

function campaignCard(campaign, escape) {
  return `<article class="card"><h2>${escape(campaign.name || "Untitled campaign")}</h2><p>${escape(campaign.goal || "No goal recorded.")}</p><p class="fine">${escape(`${words(campaign.channel) || "Channel not recorded"} · ${words(campaign.status)}`)}</p></article>`;
}

module.exports = { PROBLEMS, DONE, notice, unreadableCard, returnCard, nextStepCard, activityCard, deliveryCard, campaignLinkCard, spendCard, campaignCard };
