// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Pure business-operations analytics. The route layer decides which tenant rows
// may reach this function; this module only performs deterministic arithmetic.
// A failed or malformed row is counted as unreadable instead of being silently
// converted to zero. That keeps dashboards from turning missing data into good
// news.

// Money received is read from the two places this product records it: payments
// against an invoice (customer_invoice_payments, currency from the invoice) and
// shop orders paid through the business's own Stripe account (merchant_orders).
//
// It used to be read from `payments`, which nothing in the runtime writes. The
// summary reported "collected: 0" for every business, including one that had
// recorded thousands -- a figure that is never true, presented as a total. And
// it added cents across currencies, so a business taking both would have seen
// dollars and pounds summed into one number. Totals are per currency now, and
// there is no grand total, because there is no exchange rate here to make one.
//
// A disputed shop order is counted apart rather than as received: the money
// may be taken back, and the outcome is the card network's, not the shop's.
const RECEIVED_SHOP_STATES = new Set(["paid", "refunded"]);

// A job counts as finished once it reaches one of these, by completed_at. Its
// direct profit is workOrderLifecycle.profitability -- the same function the
// job's own page uses -- so a total here and the figure on a job cannot
// disagree. A job whose costs are not all recorded has no known profit, is
// counted apart, and adds nothing to the total rather than its revenue alone.
const FINISHED_JOB_STATES = new Set(["completed", "invoiced", "closed"]);
const { profitability } = require("./sonara-work-order-lifecycle.cjs");
const COMPLETED_BOOKING_STATUSES = new Set(["completed"]);
const CANCELLED_BOOKING_STATUSES = new Set(["cancelled"]);
const NO_SHOW_BOOKING_STATUSES = new Set(["no_show"]);

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function timestamp(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function inWindow(value, startMs, endMs) {
  const instant = timestamp(value);
  if (instant === null) return null;
  return instant >= startMs && instant < endMs;
}

function windowFrom(input = {}) {
  const nowMs = timestamp(input.now) ?? Date.now();
  const endMs = timestamp(input.periodEnd) ?? nowMs;
  const startMs = timestamp(input.periodStart) ?? (endMs - (30 * 24 * 60 * 60 * 1000));
  if (startMs >= endMs) return null;
  return { startMs, endMs, start: new Date(startMs).toISOString(), end: new Date(endMs).toISOString() };
}

function cents(value) {
  const parsed = number(value);
  return parsed === null ? null : Math.round(parsed);
}

function bookingMinutes(row) {
  const start = timestamp(row?.starts_at);
  const end = timestamp(row?.ends_at);
  if (start === null || end === null || end < start) return null;
  return Math.round((end - start) / 60000);
}

function timeEntryMinutes(row) {
  const stored = number(row?.total_minutes);
  if (stored !== null && stored >= 0) return stored;
  const start = timestamp(row?.clock_in_at);
  const end = timestamp(row?.clock_out_at);
  if (start === null || end === null || end < start) return null;
  const breaks = Math.max(0, number(row?.break_minutes) ?? 0);
  return Math.max(0, Math.round((end - start) / 60000) - breaks);
}

function inventoryLine(row) {
  const quantity = number(row?.quantity);
  const unitCost = cents(row?.cost_cents);
  if (quantity === null || unitCost === null || quantity < 0 || unitCost < 0) return null;
  const threshold = number(row?.reorder_level ?? row?.reorder_point);
  return {
    valueCents: Math.round(quantity * unitCost),
    atRisk: threshold === null ? false : quantity <= threshold
  };
}

function summarizeBusinessOperations(input = {}) {
  const window = windowFrom(input);
  if (!window) return { ok: false, code: "invalid_period" };

  const bookings = Array.isArray(input.bookings) ? input.bookings : [];
  const timeEntries = Array.isArray(input.timeEntries) ? input.timeEntries : [];
  const inventoryItems = Array.isArray(input.inventoryItems) ? input.inventoryItems : [];
  const invoicePayments = Array.isArray(input.invoicePayments) ? input.invoicePayments : [];
  const shopOrders = Array.isArray(input.shopOrders) ? input.shopOrders : [];
  const workOrders = Array.isArray(input.workOrders) ? input.workOrders : [];
  const workOrderMaterials = Array.isArray(input.workOrderMaterials) ? input.workOrderMaterials : [];
  const locationEvents = Array.isArray(input.locationEvents) ? input.locationEvents : [];

  const result = {
    ok: true,
    period: { start: window.start, end: window.end },
    bookings: {
      total: 0,
      completed: 0,
      cancelled: 0,
      noShow: 0,
      requestedOrScheduled: 0,
      completionRate: null,
      noShowRate: null,
      averageDurationMinutes: null,
      unreadable: 0
    },
    labor: { entries: 0, minutes: 0, hours: 0, openEntries: 0, unreadable: 0 },
    money: { byCurrency: [], invoicePayments: 0, shopOrders: 0, disputedShopOrders: 0, unreadable: 0 },
    jobs: { finished: 0, profitKnown: 0, costsIncomplete: 0, byCurrency: [], unreadable: 0 },
    inventory: { itemCount: inventoryItems.length, valueCents: 0, reorderRiskCount: 0, unreadable: 0 },
    location: { checkIns: 0, checkOuts: 0, routeUpdates: 0, unreadable: 0 },
    coverage: {
      bookings: "complete_for_rows_read",
      labor: "complete_for_rows_read",
      money: "invoice_payments_and_paid_shop_orders_for_rows_read",
      jobs: "jobs_finished_in_period_direct_costs_only",
      inventory: "point_in_time_for_rows_read",
      location: "consented_events_only"
    }
  };

  let durationTotal = 0;
  let durationCount = 0;
  for (const row of bookings) {
    const included = inWindow(row?.starts_at ?? row?.created_at, window.startMs, window.endMs);
    if (included === null) {
      result.bookings.unreadable += 1;
      continue;
    }
    if (!included) continue;
    result.bookings.total += 1;
    const status = String(row?.status || "").toLowerCase();
    if (COMPLETED_BOOKING_STATUSES.has(status)) result.bookings.completed += 1;
    else if (CANCELLED_BOOKING_STATUSES.has(status)) result.bookings.cancelled += 1;
    else if (NO_SHOW_BOOKING_STATUSES.has(status)) result.bookings.noShow += 1;
    else result.bookings.requestedOrScheduled += 1;
    const duration = bookingMinutes(row);
    if (duration !== null) {
      durationTotal += duration;
      durationCount += 1;
    }
  }
  if (result.bookings.total > 0) {
    result.bookings.completionRate = result.bookings.completed / result.bookings.total;
    result.bookings.noShowRate = result.bookings.noShow / result.bookings.total;
  }
  if (durationCount > 0) result.bookings.averageDurationMinutes = Math.round(durationTotal / durationCount);

  for (const row of timeEntries) {
    const included = inWindow(row?.clock_in_at ?? row?.created_at, window.startMs, window.endMs);
    if (included === null) {
      result.labor.unreadable += 1;
      continue;
    }
    if (!included) continue;
    result.labor.entries += 1;
    if (!row?.clock_out_at && number(row?.total_minutes) === null) {
      result.labor.openEntries += 1;
      continue;
    }
    const minutes = timeEntryMinutes(row);
    if (minutes === null) result.labor.unreadable += 1;
    else result.labor.minutes += minutes;
  }
  result.labor.hours = Math.round((result.labor.minutes / 60) * 100) / 100;

  const currencies = new Map();
  const bucket = (currency) => {
    if (!currencies.has(currency)) currencies.set(currency, { currency, invoiceCents: 0, invoicePayments: 0, shopNetCents: 0, shopOrders: 0, totalCents: 0 });
    return currencies.get(currency);
  };
  const currencyOf = (value) => {
    const code = String(value || "").trim().toLowerCase();
    return /^[a-z]{3}$/.test(code) ? code : null;
  };

  for (const row of invoicePayments) {
    const included = inWindow(row?.received_on ?? row?.created_at, window.startMs, window.endMs);
    if (included === null) {
      result.money.unreadable += 1;
      continue;
    }
    if (!included) continue;
    const amount = cents(row?.amount_cents);
    const currency = currencyOf(row?.currency);
    // A payment whose invoice could not be found has no currency, and a sum
    // that guessed one would be wrong in exactly the businesses that use two.
    if (amount === null || !currency) {
      result.money.unreadable += 1;
      continue;
    }
    const line = bucket(currency);
    line.invoiceCents += amount;
    line.invoicePayments += 1;
    line.totalCents += amount;
    result.money.invoicePayments += 1;
  }

  for (const row of shopOrders) {
    const state = String(row?.payment_state || "");
    const included = inWindow(row?.paid_at, window.startMs, window.endMs);
    if (included === null) {
      if (RECEIVED_SHOP_STATES.has(state) || state === "disputed") result.money.unreadable += 1;
      continue;
    }
    if (!included) continue;
    if (state === "disputed") {
      result.money.disputedShopOrders += 1;
      continue;
    }
    if (!RECEIVED_SHOP_STATES.has(state)) continue;
    const paid = cents(row?.amount_paid_cents);
    const refunded = cents(row?.refunded_cents ?? 0);
    const currency = currencyOf(row?.currency);
    if (paid === null || refunded === null || paid < 0 || refunded < 0 || !currency) {
      result.money.unreadable += 1;
      continue;
    }
    const line = bucket(currency);
    line.shopNetCents += paid - refunded;
    line.shopOrders += 1;
    line.totalCents += paid - refunded;
    result.money.shopOrders += 1;
  }
  result.money.byCurrency = [...currencies.values()].sort((a, b) => a.currency.localeCompare(b.currency));

  const materialsByJob = new Map();
  for (const line of workOrderMaterials) {
    if (!line?.work_order_id) continue;
    if (!materialsByJob.has(line.work_order_id)) materialsByJob.set(line.work_order_id, []);
    materialsByJob.get(line.work_order_id).push(line);
  }
  const jobCurrencies = new Map();
  for (const row of workOrders) {
    if (!FINISHED_JOB_STATES.has(String(row?.status || ""))) continue;
    const included = inWindow(row?.completed_at, window.startMs, window.endMs);
    if (included === null) {
      result.jobs.unreadable += 1;
      continue;
    }
    if (!included) continue;
    result.jobs.finished += 1;
    const outcome = profitability(row, materialsByJob.get(row.id) || []);
    const currency = currencyOf(row?.currency);
    if (!outcome.complete || !currency) {
      result.jobs.costsIncomplete += 1;
      continue;
    }
    result.jobs.profitKnown += 1;
    if (!jobCurrencies.has(currency)) jobCurrencies.set(currency, { currency, jobs: 0, revenueCents: 0, directCostCents: 0, profitCents: 0 });
    const line = jobCurrencies.get(currency);
    line.jobs += 1;
    line.revenueCents += outcome.revenueCents;
    line.directCostCents += outcome.directCostCents;
    line.profitCents += outcome.profitCents;
  }
  result.jobs.byCurrency = [...jobCurrencies.values()].sort((a, b) => a.currency.localeCompare(b.currency));

  for (const row of inventoryItems) {
    const line = inventoryLine(row);
    if (!line) {
      result.inventory.unreadable += 1;
      continue;
    }
    result.inventory.valueCents += line.valueCents;
    if (line.atRisk) result.inventory.reorderRiskCount += 1;
  }

  for (const row of locationEvents) {
    const included = inWindow(row?.captured_at ?? row?.created_at, window.startMs, window.endMs);
    if (included === null) {
      result.location.unreadable += 1;
      continue;
    }
    if (!included) continue;
    const type = String(row?.event_type || "");
    if (type === "check_in" || type === "job_site_arrival") result.location.checkIns += 1;
    else if (type === "check_out" || type === "job_site_departure") result.location.checkOuts += 1;
    else if (["position_update", "delivery_stop", "zone_enter", "zone_exit"].includes(type)) result.location.routeUpdates += 1;
  }

  return result;
}

module.exports = {
  RECEIVED_SHOP_STATES,
  bookingMinutes,
  inventoryLine,
  summarizeBusinessOperations,
  timeEntryMinutes,
  windowFrom
};
