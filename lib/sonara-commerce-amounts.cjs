// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Commerce columns named *_cents hold the integer sent unchanged to Stripe.
// They are minor units: 1200 means 12.00 USD but 1200 JPY. This is charge
// formatting, not FX, currency availability or payout eligibility.
// https://docs.stripe.com/currencies (checked 2026-10-08)
const DATABASE_AMOUNT_MAX = 2147483647; // Existing PostgreSQL integer columns.
const ZERO_DECIMAL_CHARGES = new Set([
  "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf",
  "vnd", "vuv", "xaf", "xof", "xpf"
]);
// ISK and UGX retain two-decimal API amounts. HUF and TWD charges also use
// two decimals; their different payout rules must not change a sales receipt.

function databaseAmount(value) {
  if (typeof value !== "number" && (typeof value !== "string" || !/^\d+$/.test(value.trim()))) return null;
  const amount = typeof value === "number" ? value : Number(value.trim());
  return Number.isSafeInteger(amount) && amount >= 0 && amount <= DATABASE_AMOUNT_MAX ? amount : null;
}

function formatChargeAmount(value, currency = "usd", { style = "code" } = {}) {
  if (typeof value !== "number" && (typeof value !== "string" || !/^-?\d+$/.test(value.trim()))) return "Amount unavailable";
  const amount = typeof value === "number" ? value : Number(value.trim());
  if (!Number.isSafeInteger(amount)) return "Amount unavailable";
  const code = typeof currency === "string" ? currency.trim().toLowerCase() : "";
  if (!/^[a-z]{3}$/.test(code)) return `${amount} minor units (currency unavailable)`;
  const digits = ZERO_DECIMAL_CHARGES.has(code) ? 0 : 2;
  // Split the integer's decimal string instead of dividing a large integer
  // by 100: the latter can round away the last minor unit even within the
  // safe-integer range. Aggregate reports can exceed a single database row.
  const integer = String(Math.abs(amount)).padStart(digits + 1, "0");
  const whole = digits ? integer.slice(0, -digits) : integer;
  const rendered = (amount < 0 ? "-" : "") + whole + (digits ? `.${integer.slice(-digits)}` : "");
  if (style === "international") {
    // Intl receives the exact decimal string, with Stripe's denomination
    // overriding ISO defaults. It supplies symbols and grouping, not scaling.
    return new Intl.NumberFormat("en", { style: "currency", currency: code,
      minimumFractionDigits: digits, maximumFractionDigits: digits }).format(rendered);
  }
  const mark = style === "symbol" ? { usd: "$", gbp: "£", eur: "€" }[code] : null;
  return mark ? `${mark}${rendered}` : `${rendered} ${code.toUpperCase()}`;
}

module.exports = { DATABASE_AMOUNT_MAX, databaseAmount, formatChargeAmount };
