// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

/**
 * Synthetic moving-average research backtest, NOT brokerage execution, market
 * data, signal advice, exchange-grade accounting, or a valid performance claim.
 * Decisions use prior observations only; synthetic fills occur at the next
 * observed sample (idealized, no spread, slippage, partial fills or liquidity).
 */
const MAX_OBSERVATIONS = 500;
const MAX_TRADES = 500;
const { evaluateMaxDrawdown } = require("./sonara-game-risk-paper-trading.cjs");

function boundInt(value, name, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(name + " must be an integer in [" + min + ", " + max + "]");
  }
  return value;
}
function valueAt(prices, start, length) {
  let total = 0n;
  for (let i = start; i < start + length; i++) total += BigInt(prices[i]);
  return total;
}

/** Long-only, cash-only, no interpolation. Index i signal uses only data < i. */
function backtestSyntheticSma({
  pricesCents, fastWindow = 3, slowWindow = 7,
  startingVirtualCashCents = 1_000_000, feeCents = 0
}) {
  if (!Array.isArray(pricesCents) || pricesCents.length < 5 ||
      pricesCents.length > MAX_OBSERVATIONS) {
    throw new RangeError("pricesCents must hold 5..500 hypothetical observations");
  }
  const prices = pricesCents.map((value, i) =>
    boundInt(value, "pricesCents[" + i + "]", 1, 100_000_000));
  boundInt(fastWindow, "fastWindow", 2, 50);
  boundInt(slowWindow, "slowWindow", fastWindow + 1,
    Math.min(100, prices.length - 1));
  boundInt(startingVirtualCashCents, "startingVirtualCashCents", 1, 1_000_000_000);
  boundInt(feeCents, "feeCents", 0, 100_000);

  let cash = BigInt(startingVirtualCashCents);
  let quantity = 0n;
  const actions = [];
  const curve = [];
  const fee = BigInt(feeCents);
  for (let i = 0; i < prices.length; i++) {
    const price = BigInt(prices[i]);
    if (i >= slowWindow) {
      const fast = valueAt(prices, i - fastWindow, fastWindow);
      const slow = valueAt(prices, i - slowWindow, slowWindow);
      const desireLong = fast * BigInt(slowWindow) > slow * BigInt(fastWindow);
      if (desireLong && quantity === 0n && cash > fee) {
        const affordable = (cash - fee) / price;
        if (affordable > 0n) {
          cash -= affordable * price + fee;
          quantity = affordable;
          actions.push(Object.freeze({
            index: i, side: "buy", shares: Number(affordable),
            assumedFillCents: prices[i], feeCents
          }));
        }
      } else if (!desireLong && quantity > 0n && quantity * price > fee) {
        cash += quantity * price - fee;
        actions.push(Object.freeze({
          index: i, side: "sell", shares: Number(quantity),
          assumedFillCents: prices[i], feeCents
        }));
        quantity = 0n;
      }
    }
    const mark = cash + quantity * price;
    if (mark > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("paper equity overflow");
    curve.push(Number(mark));
  }
  if (actions.length > MAX_TRADES) throw new RangeError("too many trades");
  const last = BigInt(prices[prices.length - 1]);
  const finalVirtualEquityCents = Number(cash + quantity * last);
  const benchmarkShares = BigInt(startingVirtualCashCents) / BigInt(prices[0]);
  const benchmarkCash = BigInt(startingVirtualCashCents) -
    benchmarkShares * BigInt(prices[0]);
  const hypotheticalBuyHoldEquityCents = Number(benchmarkCash + benchmarkShares * last);
  return Object.freeze({
    mode: "synthetic_backtest_only",
    provenance: "caller_supplied_prices_no_market_feed",
    executionAssumption: "previous_close_signal_next_sample_ideal_fill",
    observations: prices.length, fastWindow, slowWindow,
    startingVirtualCashCents, feeCents,
    finalVirtualCashCents: Number(cash),
    finalShares: Number(quantity),
    finalVirtualEquityCents,
    returnFraction: finalVirtualEquityCents / startingVirtualCashCents - 1,
    hypotheticalBuyHoldEquityCents,
    maxDrawdownFraction: evaluateMaxDrawdown(curve).maxDrawdownFraction,
    tradeCount: actions.length,
    actions: Object.freeze(actions)
  });
}
module.exports = { MAX_OBSERVATIONS, MAX_TRADES, backtestSyntheticSma };
