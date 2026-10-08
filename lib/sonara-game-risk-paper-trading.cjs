// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

/**
 * Research-only casino probability, hypothetical sports odds and paper trading.
 * NO live wagering, redeemable credits, custody, payments, brokerage orders,
 * market feeds, accounts or regulatory-certification claims.
 * Math is illustrative; floating-point outputs are never ledger settlement.
 */
const { createSeededRng } = require("./sonara-creative-simulation-kernel.cjs");
const ROULETTE_POCKETS = 38; // American roulette: 0, 00, 1..36
const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const MAX_PAPER_CASH_CENTS = 1_000_000_000_000;
const MAX_PAPER_ORDERS = 200;
const BOUNDARIES = Object.freeze({
  authority: "research_and_paper_only",
  liveWagering: false,
  redeemablePoints: false,
  depositsAndWithdrawals: false,
  liveTrading: false,
  marketOrders: false,
  regulatoryCertified: false
});

function safeInt(value, name, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(name + " must be a safe integer in [" + min + ", " + max + "]");
  }
  return value;
}
function toBoundedNumber(value, name, upper = MAX_PAPER_CASH_CENTS) {
  if (value < 0n || value > BigInt(upper)) throw new RangeError(name + " exceeds sandbox bounds");
  return Number(value);
}
function symbolId(value) {
  if (typeof value !== "string" || !/^[A-Z][A-Z0-9.-]{0,9}$/.test(value)) {
    throw new TypeError("symbol must use 1..10 uppercase ticker characters");
  }
  return value;
}

/** American single-zero/double-zero wheel, no dealer, no stake or game session. */
function evaluateRouletteTheory({ betType, number, virtualStakePoints = 1 }) {
  safeInt(virtualStakePoints, "virtualStakePoints", 1, 1_000_000);
  const fixed = {
    red: [18, 1], black: [18, 1],
    "first-dozen": [12, 2], "second-dozen": [12, 2],
    "third-dozen": [12, 2]
  };
  let winningPockets, payoutToOne;
  if (betType === "straight") {
    safeInt(number, "number", 0, 36); // 00 uses the distinct token "00"
    winningPockets = 1;
    payoutToOne = 35;
  } else if (betType === "double-zero") {
    if (number !== undefined) throw new TypeError("double-zero takes no number");
    winningPockets = 1;
    payoutToOne = 35;
  } else if (Object.prototype.hasOwnProperty.call(fixed, betType)) {
    if (number !== undefined) throw new TypeError("number is valid only for straight");
    [winningPockets, payoutToOne] = fixed[betType];
  } else {
    throw new RangeError("unsupported American roulette bet type");
  }
  // Net return counts losing stake and excludes costs/promotions.
  const numerator = virtualStakePoints *
    (winningPockets * payoutToOne - (ROULETTE_POCKETS - winningPockets));
  return Object.freeze({
    game: "american_roulette_theory_only",
    betType, ...(betType === "straight" ? { number } : {}),
    virtualStakePoints, totalPockets: ROULETTE_POCKETS, winningPockets,
    netWinMultiplier: payoutToOne, probabilityOfWin: winningPockets / ROULETTE_POCKETS,
    expectedNetNumerator: numerator, expectedNetDenominator: ROULETTE_POCKETS,
    expectedNetVirtualPoints: numerator / ROULETTE_POCKETS,
    theoreticalHouseEdge: -numerator / (ROULETTE_POCKETS * virtualStakePoints)
  });
}

/** Bounded reproducible COLOR demonstration; not a regulated or secure RNG. */
function sampleRouletteColors({ rounds = 1000, seed = 1 }) {
  safeInt(rounds, "rounds", 1, 10000);
  const rng = createSeededRng(seed);
  const colors = { red: 0, black: 0, green: 0 };
  for (let i = 0; i < rounds; i++) {
    const pocket = Math.floor(rng.next() * ROULETTE_POCKETS);
    if (pocket === 0 || pocket === 37) colors.green++;
    else if (RED_NUMBERS.has(pocket)) colors.red++;
    else colors.black++;
  }
  return Object.freeze({ game: "roulette_color_sampling_only", rounds, seed,
    colors: Object.freeze(colors), fairGamingCertified: false });
}

/** Decimal odds in 10,000ths; p in millionths. No bookmaker or betting API. */
function evaluateHypotheticalOdds({
  virtualStakePoints, decimalOddsBasisPoints, modeledWinProbabilityPpm
}) {
  safeInt(virtualStakePoints, "virtualStakePoints", 1, 1_000_000);
  safeInt(decimalOddsBasisPoints, "decimalOddsBasisPoints", 10001, 1_000_000);
  safeInt(modeledWinProbabilityPpm, "modeledWinProbabilityPpm", 0, 1_000_000);
  const decimalOdds = decimalOddsBasisPoints / 10000;
  const p = modeledWinProbabilityPpm / 1_000_000;
  return Object.freeze({
    mode: "educational_hypothesis_only",
    virtualStakePoints, decimalOdds,
    breakEvenProbability: 1 / decimalOdds,
    modeledProbability: p,
    hypotheticalNetWinPoints: virtualStakePoints * (decimalOdds - 1),
    hypotheticalNetLossPoints: -virtualStakePoints,
    hypotheticalExpectedNetPoints: virtualStakePoints * (p * decimalOdds - 1)
  });
}

/** All cash is synthetic virtual cents. No deposits, transfers or real fills. */
function createPaperPortfolio(startingVirtualCashCents = 1_000_000) {
  safeInt(startingVirtualCashCents, "startingVirtualCashCents", 0, MAX_PAPER_CASH_CENTS);
  return Object.freeze({
    mode: "paper_only", revision: 0, startingVirtualCashCents,
    virtualCashCents: startingVirtualCashCents, positions: Object.freeze({}),
    history: Object.freeze([])
  });
}
function validatePortfolio(state) {
  if (!state || state.mode !== "paper_only" ||
      !Number.isSafeInteger(state.revision) || state.revision < 0 ||
      state.revision > MAX_PAPER_ORDERS || !Array.isArray(state.history) ||
      state.history.length !== state.revision ||
      !state.positions || typeof state.positions !== "object" ||
      Array.isArray(state.positions)) throw new TypeError("invalid paper portfolio");
  safeInt(state.virtualCashCents, "virtualCashCents", 0, MAX_PAPER_CASH_CENTS);
  safeInt(state.startingVirtualCashCents, "startingVirtualCashCents", 0, MAX_PAPER_CASH_CENTS);
  for (const [symbol, shares] of Object.entries(state.positions)) {
    symbolId(symbol);
    safeInt(shares, "position shares", 1, 10_000_000);
  }
}
function applyPaperOrder(state, {
  symbol, side, shares, priceCents, feeCents = 0, expectedRevision
}) {
  validatePortfolio(state);
  symbolId(symbol);
  if (side !== "buy" && side !== "sell") throw new RangeError("side must be buy or sell");
  safeInt(shares, "shares", 1, 100_000);
  safeInt(priceCents, "priceCents", 1, 100_000_000);
  safeInt(feeCents, "feeCents", 0, 1_000_000);
  safeInt(expectedRevision, "expectedRevision", 0, MAX_PAPER_ORDERS);
  if (state.revision !== expectedRevision) throw new Error("stale paper portfolio revision");
  if (state.revision >= MAX_PAPER_ORDERS) throw new RangeError("sandbox order count exhausted");
  const oldShares = state.positions[symbol] || 0;
  if (side === "sell" && oldShares < shares) throw new RangeError("short selling disabled");
  const nextShares = side === "buy" ? oldShares + shares : oldShares - shares;
  safeInt(nextShares, "nextShares", 0, 10_000_000);
  const amount = BigInt(shares) * BigInt(priceCents);
  const cashChange = side === "buy" ? -amount - BigInt(feeCents) : amount - BigInt(feeCents);
  const virtualCashCents = toBoundedNumber(
    BigInt(state.virtualCashCents) + cashChange, "paper cash");
  const positions = { ...state.positions };
  if (nextShares === 0) delete positions[symbol];
  else positions[symbol] = nextShares;
  const receipt = Object.freeze({
    revision: state.revision + 1, symbol, side, shares, priceCents, feeCents,
    execution: "hypothetical_only"
  });
  return Object.freeze({
    mode: "paper_only", revision: state.revision + 1,
    startingVirtualCashCents: state.startingVirtualCashCents,
    virtualCashCents,
    positions: Object.freeze(positions),
    history: Object.freeze([...state.history, receipt])
  });
}

/** Requires caller-supplied hypothetical prices; does not fetch financial data. */
function markPaperPortfolio(state, hypotheticalPricesCents) {
  validatePortfolio(state);
  if (!hypotheticalPricesCents || typeof hypotheticalPricesCents !== "object" ||
      Array.isArray(hypotheticalPricesCents)) throw new TypeError("hypothetical prices required");
  let positionValue = 0n;
  for (const [symbol, shares] of Object.entries(state.positions)) {
    const mark = hypotheticalPricesCents[symbol];
    safeInt(mark, "hypothetical price " + symbol, 0, 100_000_000);
    positionValue += BigInt(mark) * BigInt(shares);
  }
  const positionValueCents = toBoundedNumber(positionValue, "position value");
  const virtualEquityCents = toBoundedNumber(
    positionValue + BigInt(state.virtualCashCents), "paper equity");
  return Object.freeze({
    mode: "hypothetical_mark_only", revision: state.revision,
    positionValueCents, virtualCashCents: state.virtualCashCents,
    virtualEquityCents,
    hypotheticalProfitLossCents: virtualEquityCents - state.startingVirtualCashCents
  });
}

/** Decline from previous peak in a synthetic equity sequence, not future VaR. */
function evaluateMaxDrawdown(virtualEquitySeries) {
  if (!Array.isArray(virtualEquitySeries) ||
      virtualEquitySeries.length < 1 || virtualEquitySeries.length > 1000) {
    throw new RangeError("virtualEquitySeries needs 1..1000 entries");
  }
  virtualEquitySeries.forEach((v, i) =>
    safeInt(v, "virtualEquitySeries[" + i + "]", 0, MAX_PAPER_CASH_CENTS));
  if (virtualEquitySeries[0] === 0) throw new RangeError("initial equity must exceed zero");
  let peak = virtualEquitySeries[0], maxDrawdownPoints = 0, maxDrawdownFraction = 0;
  for (const value of virtualEquitySeries) {
    if (value > peak) peak = value;
    const fraction = (peak - value) / peak;
    if (fraction > maxDrawdownFraction) {
      maxDrawdownFraction = fraction;
      maxDrawdownPoints = peak - value;
    }
  }
  return Object.freeze({ mode: "historical_scenario_only",
    observations: virtualEquitySeries.length,
    maxDrawdownPoints, maxDrawdownFraction });
}

module.exports = {
  BOUNDARIES, ROULETTE_POCKETS, MAX_PAPER_ORDERS, evaluateRouletteTheory,
  sampleRouletteColors, evaluateHypotheticalOdds, createPaperPortfolio,
  applyPaperOrder, markPaperPortfolio, evaluateMaxDrawdown
};
