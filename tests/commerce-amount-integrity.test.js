// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert = require("node:assert/strict");
const amounts = require("../lib/sonara-commerce-amounts.cjs");
const shop = require("../lib/sonara-merchant-storefront.cjs");
const market = require("../lib/sonara-creator-marketplace.cjs");
const payments = require("../lib/sonara-merchant-payments.cjs");
const ID = "11111111-1111-4111-8111-111111111111";
const SECOND = "22222222-2222-4222-8222-222222222222";
const product = { name: "Mug", status: "active" };
const variant = { id: ID, variant_name: "Large", price_cents: 1200, currency: "usd", status: "active" };
const entry = (id, price) => ({ product, variant: { ...variant, id },
  offer: shop.offerFor(product, { ...variant, price_cents: price }, "usd") });

describe("commerce amounts keep their type, range and currency", () => {
  for (const value of [true, false, [1200], { valueOf: () => 1200 }, "1e2", "0x10", "12.0",
    " ", null, undefined, NaN, Infinity, -1, 1.5, 2147483648, Number.MAX_SAFE_INTEGER + 1]) {
    it("refuses a price outside the database contract: " + String(value), () => {
      assert.equal(amounts.databaseAmount(value), null);
      assert.equal(market.integerCents(value), null);
      const offer = shop.offerFor(product, { ...variant, price_cents: value }, "usd");
      assert.equal(offer.ok, false);
      assert.equal(offer.code, "price_unreadable");
    });
  }
  it("preserves zero, trimmed decimal integers and the exact PostgreSQL upper boundary", () => {
    assert.equal(amounts.databaseAmount(0), 0);
    assert.equal(amounts.databaseAmount(" 001200 "), 1200);
    assert.equal(amounts.databaseAmount("2147483647"), 2147483647);
    assert.equal(shop.offerFor(product, { ...variant, price_cents: 0 }, "usd").code, "price_not_set");
  });
  it("accepts an order at the database boundary but rejects a multiplied line beyond it", () => {
    const offered = [entry(ID, 2147483647)];
    assert.equal(shop.priceOrder({ offered, quantities: { [ID]: 1 } }).subtotalCents, 2147483647);
    const result = shop.priceOrder({ offered, quantities: { [ID]: 2 } });
    assert.equal(result.ok, false);
    assert.deepEqual(result.problems, ["order_amount_too_large"]);
    assert.deepEqual(result.lines, []);
  });
  it("rejects aggregate overflow even when every individual line fits", () => {
    const result = shop.priceOrder({ offered: [entry(ID, 1073741824), entry(SECOND, 1073741824)],
      quantities: { [ID]: 1, [SECOND]: 1 } });
    assert.equal(result.ok, false);
    assert.deepEqual(result.problems, ["order_amount_too_large"]);
    assert.deepEqual(result.lines, []);
    assert.equal(result.subtotalCents, 0);
  });
  it("refuses coerced quantities and malformed offers even for a direct caller", () => {
    for (const quantity of [true, [2], "1e2"]) {
      assert.equal(shop.priceOrder({ offered: [entry(ID, 1200)], quantities: { [ID]: quantity } }).ok, false);
    }
    const offer = entry(ID, 1200);
    offer.offer = { ...offer.offer, priceCents: true };
    assert.equal(shop.priceOrder({ offered: [offer], quantities: { [ID]: 1 } }).ok, false);
  });
  it("refuses to open payment for an unreadable stored total", () => {
    for (const subtotal of [true, -1, 2147483648, Number.MAX_SAFE_INTEGER + 1]) {
      const result = payments.payDecision({ order: { status: "placed", payment_state: "unpaid", subtotal_cents: subtotal },
        lines: [], payment: { ok: true, accountId: "acct_seller12345678" } });
      assert.equal(result.ok, false);
      assert.equal(result.code, "nothing_to_pay");
    }
  });
  // Expected examples from Stripe's charge-denomination documentation, not
  // from Intl's ISO defaults (MGA and compatibility currencies differ).
  for (const [value, currency, expected] of [
    [1000, "usd", "10.00 USD"], [1000, "jpy", "1000 JPY"],
    [1200, "krw", "1200 KRW"], [1200, "mga", "1200 MGA"],
    [500, "isk", "5.00 ISK"], [500, "ugx", "5.00 UGX"],
    [1045, "huf", "10.45 HUF"], [80045, "twd", "800.45 TWD"]
  ]) it("displays the charge exactly: " + expected, () => {
    assert.equal(amounts.formatChargeAmount(value, currency), expected);
    assert.equal(shop.money(value, currency), expected);
  });
  it("keeps large report totals exact and permits negative balance records", () => {
    assert.equal(amounts.formatChargeAmount(Number.MAX_SAFE_INTEGER, "usd"), "90071992547409.91 USD");
    assert.equal(amounts.formatChargeAmount(-Number.MAX_SAFE_INTEGER, "usd"), "-90071992547409.91 USD");
    assert.equal(amounts.formatChargeAmount(-95, "eur"), "-0.95 EUR");
    assert.equal(amounts.formatChargeAmount(1200, "usd", { style: "symbol" }), "$12.00");
    assert.equal(amounts.formatChargeAmount(Number.MAX_SAFE_INTEGER, "usd", { style: "international" }), "$90,071,992,547,409.91");
  });
  it("never renders an absent, coerced or unsafe amount as free", () => {
    for (const value of [null, undefined, "", " ", true, [1200], "1e2", 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      assert.equal(amounts.formatChargeAmount(value, "usd"), "Amount unavailable");
      assert.equal(shop.money(value, "usd"), "Amount unavailable");
    }
    assert.equal(amounts.formatChargeAmount(0, "usd"), "0.00 USD");
    assert.equal(amounts.formatChargeAmount(1200, null), "1200 minor units (currency unavailable)");
  });
});
