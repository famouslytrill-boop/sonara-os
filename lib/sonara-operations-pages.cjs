// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// How the business is doing, as a page.
//
// GET /api/business/operations/analytics computed this and nothing showed it.
// Building the page found the figure that mattered most was wrong: money
// received was read from a table nothing writes, so it was zero for everybody.
// lib/sonara-business-analytics.cjs now reads invoice payments and paid shop
// orders, per currency. This file renders what that returns and nothing else.
//
// Three rules, each one a way this kind of page has been wrong before:
//   - a source that could not be read is named, and no figure is shown in its
//     place -- the route refuses to turn a failed read into a zero;
//   - a read that came back at its limit is named beside the figure, because a
//     total over the first thousand rows is "at least", not "is";
//   - money is shown per currency and never added across them.

const PERIODS = Object.freeze([7, 30, 90, 365]);

const SOURCE_NAMES = Object.freeze({
  workspace: "which business you are signed in to",
  bookings: "bookings",
  time: "hours clocked",
  inventory: "stock",
  invoicePayments: "payments recorded against invoices",
  invoices: "the invoices those payments belong to",
  shopOrders: "shop orders",
  workOrders: "finished jobs",
  workOrderMaterials: "the materials used on finished jobs",
  locations: "check-ins"
});

const money = (cents, currency) => {
  const value = (Number(cents) / 100).toFixed(2);
  return `${String(currency || "").toUpperCase()} ${value}`;
};

function periodForm(days, path, escape) {
  return `<form method="get" action="${escape(path)}" class="card"><label>Period<select name="days">${PERIODS.map((value) => `<option value="${value}"${value === days ? " selected" : ""}>Last ${value} days</option>`).join("")}</select></label><button type="submit">Show</button></form>`;
}

function unreadableCard(sources, escape) {
  const names = sources.map((source) => SOURCE_NAMES[source] || "part of your records");
  return `<article class="card" role="alert"><h2>We could not read everything</h2><p>We could not read ${escape(names.join(", "))} just now, so no figures are shown. This is not the same as having none -- try again shortly.</p></article>`;
}

function capped(truncated, keys) {
  return keys.some((key) => truncated.includes(key))
    ? "<p class=\"fine\">There were more records than we read at once, so this is at least the figure shown, not the full figure.</p>"
    : "";
}

function moneyCard(summary, escape) {
  const lines = summary.money.byCurrency;
  const body = lines.length
    ? `<table><thead><tr><th>Currency</th><th>Against invoices</th><th>From the shop, after refunds</th><th>Received</th></tr></thead><tbody>${lines.map((line) => `<tr><td>${escape(line.currency.toUpperCase())}</td><td>${escape(money(line.invoiceCents, line.currency))} (${line.invoicePayments})</td><td>${escape(money(line.shopNetCents, line.currency))} (${line.shopOrders})</td><td><strong>${escape(money(line.totalCents, line.currency))}</strong></td></tr>`).join("")}</tbody></table>`
    : "<p>No money recorded as received in this period.</p>";
  const notes = [
    lines.length > 1 ? "Each currency is totalled on its own. They are not added together, because no exchange rate is applied here." : "",
    summary.money.disputedShopOrders ? `${summary.money.disputedShopOrders} shop order(s) are in dispute and are not counted as received.` : "",
    summary.money.unreadable ? `${summary.money.unreadable} payment record(s) could not be read -- a missing amount, date or currency -- and are not counted.` : ""
  ].filter(Boolean).map((text) => `<p class="fine">${escape(text)}</p>`).join("");
  return `<article class="card"><h2>Money received</h2>${body}${notes}${capped(summary.truncatedSources, ["invoicePayments", "shopOrders"])}</article>`;
}

function jobsCard(summary, escape) {
  const j = summary.jobs;
  const lines = j.byCurrency;
  const table = lines.length
    ? `<table><thead><tr><th>Currency</th><th>Jobs</th><th>Agreed price</th><th>Direct costs</th><th>Direct profit</th></tr></thead><tbody>${lines.map((line) => `<tr><td>${escape(line.currency.toUpperCase())}</td><td>${line.jobs}</td><td>${escape(money(line.revenueCents, line.currency))}</td><td>${escape(money(line.directCostCents, line.currency))}</td><td><strong>${escape(money(line.profitCents, line.currency))}</strong></td></tr>`).join("")}</tbody></table>`
    : "<p>No finished job in this period has all its costs recorded.</p>";
  const notes = [
    `${j.finished} job(s) finished in this period.`,
    j.costsIncomplete ? `${j.costsIncomplete} of them have a price or a cost not recorded, so they are not in the profit figure. Open each one from work orders and fill in what is missing.` : "",
    "Direct profit is the agreed price less labour, travel, other costs and materials recorded on the job, worked out the same way as on each job's own page. Overheads are not included.",
    j.unreadable ? `${j.unreadable} job(s) have no readable finish date and are not counted.` : ""
  ].filter(Boolean).map((text) => `<p class="fine">${escape(text)}</p>`).join("");
  return `<article class="card"><h2>Jobs finished</h2>${table}${notes}${capped(summary.truncatedSources, ["workOrders"])}</article>`;
}

const percent = (rate) => (rate === null || rate === undefined ? "Not enough to say" : `${Math.round(rate * 100)}%`);

function bookingsCard(summary, escape) {
  const b = summary.bookings;
  return `<article class="card"><h2>Bookings</h2><table><tbody><tr><td>In this period</td><td>${b.total}</td></tr><tr><td>Completed</td><td>${b.completed}</td></tr><tr><td>Cancelled</td><td>${b.cancelled}</td></tr><tr><td>Did not turn up</td><td>${b.noShow}</td></tr><tr><td>Still to happen or unconfirmed</td><td>${b.requestedOrScheduled}</td></tr><tr><td>Completed of all booked</td><td>${escape(percent(b.completionRate))}</td></tr><tr><td>Average length</td><td>${escape(b.averageDurationMinutes === null ? "Not enough to say" : `${b.averageDurationMinutes} minutes`)}</td></tr></tbody></table>${b.unreadable ? `<p class="fine">${b.unreadable} booking(s) had no readable date and are not counted.</p>` : ""}${capped(summary.truncatedSources, ["bookings"])}</article>`;
}

function hoursCard(summary) {
  const l = summary.labor;
  return `<article class="card"><h2>Hours worked</h2><table><tbody><tr><td>Hours clocked</td><td>${l.hours}</td></tr><tr><td>Shifts recorded</td><td>${l.entries}</td></tr><tr><td>Still clocked in</td><td>${l.openEntries}</td></tr></tbody></table>${l.openEntries ? "<p class=\"fine\">Somebody still clocked in is not counted in the hours until they clock out.</p>" : ""}${l.unreadable ? `<p class="fine">${l.unreadable} time record(s) could not be read and are not counted.</p>` : ""}${capped(summary.truncatedSources, ["time"])}</article>`;
}

function stockCard(summary) {
  const i = summary.inventory;
  return `<article class="card"><h2>Stock</h2><table><tbody><tr><td>Items</td><td>${i.itemCount}</td></tr><tr><td>At or below their reorder level</td><td>${i.reorderRiskCount}</td></tr><tr><td>Value at cost</td><td>${(i.valueCents / 100).toFixed(2)}</td></tr></tbody></table><p class="fine">Stock as it is now, not as it was during the period.</p>${i.unreadable ? `<p class="fine">${i.unreadable} item(s) have no readable quantity or cost and are not counted.</p>` : ""}${capped(summary.truncatedSources, ["inventory"])}</article>`;
}

function fieldCard(summary) {
  const l = summary.location;
  return `<article class="card"><h2>Check-ins at jobs</h2><table><tbody><tr><td>Arrivals</td><td>${l.checkIns}</td></tr><tr><td>Departures</td><td>${l.checkOuts}</td></tr><tr><td>Route updates</td><td>${l.routeUpdates}</td></tr></tbody></table><p class="fine">Only from people who agreed to share their location.</p>${capped(summary.truncatedSources, ["locations"])}</article>`;
}

function sections(summary, { path, escape }) {
  return [
    periodForm(summary.days, path, escape),
    moneyCard(summary, escape),
    jobsCard(summary, escape),
    bookingsCard(summary, escape),
    hoursCard(summary),
    stockCard(summary),
    fieldCard(summary)
  ];
}

module.exports = { PERIODS, SOURCE_NAMES, periodForm, unreadableCard, sections };
