"use strict";

const assert = require("node:assert/strict");
const {
  BOUNDARIES, ROULETTE_POCKETS, MAX_PAPER_ORDERS,
  evaluateRouletteTheory, sampleRouletteColors, evaluateHypotheticalOdds,
  createPaperPortfolio, applyPaperOrder, markPaperPortfolio, evaluateMaxDrawdown
} = require("../lib/sonara-game-risk-paper-trading.cjs");

describe("SONARA hypothetical gaming and paper trading guardrails", () => {
  it("has permanently non-executing research boundaries", () => {
    assert.equal(BOUNDARIES.authority, "research_and_paper_only");
    for (const key of ["liveWagering", "redeemablePoints", "depositsAndWithdrawals",
      "liveTrading", "marketOrders", "regulatoryCertified"]) {
      assert.equal(BOUNDARIES[key], false, key);
    }
    assert.ok(Object.isFrozen(BOUNDARIES));
  });

  it("calculates American roulette red/black theoretical house edge", () => {
    assert.equal(ROULETTE_POCKETS, 38);
    const red = evaluateRouletteTheory({ betType: "red", virtualStakePoints: 38 });
    const black = evaluateRouletteTheory({ betType: "black", virtualStakePoints: 38 });
    assert.equal(red.winningPockets, 18);
    assert.equal(red.expectedNetNumerator, -76);
    assert.equal(red.expectedNetDenominator, 38);
    assert.equal(red.expectedNetVirtualPoints, -2);
    assert.equal(red.theoreticalHouseEdge, 2 / 38);
    assert.equal(black.theoreticalHouseEdge, 2 / 38);
  });

  it("calculates dozen/straight and double-zero payout math", () => {
    const dozen = evaluateRouletteTheory({ betType: "third-dozen", virtualStakePoints: 38 });
    const straight = evaluateRouletteTheory({ betType: "straight", number: 17, virtualStakePoints: 38 });
    const green = evaluateRouletteTheory({ betType: "double-zero", virtualStakePoints: 38 });
    assert.deepEqual([dozen.winningPockets, dozen.netWinMultiplier], [12, 2]);
    assert.deepEqual([straight.winningPockets, straight.netWinMultiplier], [1, 35]);
    assert.equal(green.netWinMultiplier, 35);
    for (const res of [dozen, straight, green]) {
      assert.equal(res.theoreticalHouseEdge, 2 / 38);
      assert.equal(res.expectedNetVirtualPoints, -2);
    }
  });

  it("rejects unsupported roulette bets and real-value-like invalid stakes", () => {
    assert.throws(() => evaluateRouletteTheory({ betType: "sports", virtualStakePoints: 1 }), RangeError);
    assert.throws(() => evaluateRouletteTheory({ betType: "straight", number: 37 }), RangeError);
    assert.throws(() => evaluateRouletteTheory({ betType: "straight", number: -1 }), RangeError);
    assert.throws(() => evaluateRouletteTheory({ betType: "red", number: 7 }), TypeError);
    assert.throws(() => evaluateRouletteTheory({ betType: "red", virtualStakePoints: -1 }), RangeError);
    assert.throws(() => evaluateRouletteTheory({ betType: "red", virtualStakePoints: 1.5 }), RangeError);
  });

  it("replays roulette COLOR samples and excludes financial stakes", () => {
    const a = sampleRouletteColors({ rounds: 1000, seed: 117 });
    assert.deepEqual(a, sampleRouletteColors({ rounds: 1000, seed: 117 }));
    assert.equal(a.colors.red + a.colors.black + a.colors.green, 1000);
    assert.equal(a.fairGamingCertified, false);
    assert.ok(Object.isFrozen(a.colors));
    assert.ok(Object.isFrozen(a));
  });

  it("bounds roulette sampler work and prevents invalid seeds", () => {
    assert.throws(() => sampleRouletteColors({ rounds: 10001 }), RangeError);
    assert.throws(() => sampleRouletteColors({ rounds: 0 }), RangeError);
    assert.throws(() => sampleRouletteColors({ rounds: 10, seed: 0 }), RangeError);
  });

  it("explains fixed-odds break-even without offering execution", () => {
    const out = evaluateHypotheticalOdds({
      virtualStakePoints: 100, decimalOddsBasisPoints: 20000,
      modeledWinProbabilityPpm: 600000
    });
    assert.equal(out.breakEvenProbability, 0.5);
    assert.equal(out.modeledProbability, 0.6);
    assert.equal(out.hypotheticalNetWinPoints, 100);
    assert.equal(out.hypotheticalNetLossPoints, -100);
    assert.ok(Math.abs(out.hypotheticalExpectedNetPoints - 20) < 1e-9);
    assert.equal(out.mode, "educational_hypothesis_only");
  });

  it("shows model disadvantage and rejects bad fixed odds", () => {
    const out = evaluateHypotheticalOdds({
      virtualStakePoints: 100, decimalOddsBasisPoints: 25000,
      modeledWinProbabilityPpm: 200000
    });
    assert.equal(out.hypotheticalExpectedNetPoints, -50);
    assert.throws(() => evaluateHypotheticalOdds({
      virtualStakePoints: 100, decimalOddsBasisPoints: 10000,
      modeledWinProbabilityPpm: 200000
    }), RangeError);
    assert.throws(() => evaluateHypotheticalOdds({
      virtualStakePoints: 100, decimalOddsBasisPoints: 20000,
      modeledWinProbabilityPpm: 1000001
    }), RangeError);
  });

  it("creates a zero-network virtual paper portfolio", () => {
    const state = createPaperPortfolio(10000);
    assert.equal(state.mode, "paper_only");
    assert.equal(state.revision, 0);
    assert.equal(state.virtualCashCents, 10000);
    assert.deepEqual(state.positions, {});
    assert.ok(Object.isFrozen(state));
    assert.ok(Object.isFrozen(state.history));
    assert.throws(() => createPaperPortfolio(-1), RangeError);
  });

  it("buys, marks, sells and preserves original immutable paper state", () => {
    const starting = createPaperPortfolio(10000);
    const bought = applyPaperOrder(starting, {
      symbol: "DEMO", side: "buy", shares: 2, priceCents: 1500,
      feeCents: 5, expectedRevision: 0
    });
    assert.equal(starting.virtualCashCents, 10000);
    assert.deepEqual(starting.positions, {});
    assert.equal(bought.virtualCashCents, 6995);
    assert.equal(bought.positions.DEMO, 2);
    const marked = markPaperPortfolio(bought, { DEMO: 2000 });
    assert.equal(marked.virtualEquityCents, 10995);
    assert.equal(marked.hypotheticalProfitLossCents, 995);
    const sold = applyPaperOrder(bought, {
      symbol: "DEMO", side: "sell", shares: 2,
      priceCents: 2000, feeCents: 10, expectedRevision: 1
    });
    assert.equal(sold.virtualCashCents, 10985);
    assert.deepEqual(sold.positions, {});
    assert.equal(sold.history.length, 2);
    assert.equal(sold.history[1].execution, "hypothetical_only");
    assert.ok(Object.isFrozen(sold.positions));
  });

  it("prevents borrowing, shorting, invalid tickers and stale trade replay", () => {
    const state = createPaperPortfolio(10000);
    const buy = { symbol: "DEMO", side: "buy", shares: 1, priceCents: 500, expectedRevision: 0 };
    const next = applyPaperOrder(state, buy);
    assert.throws(() => applyPaperOrder(next, buy), /stale/);
    assert.throws(() => applyPaperOrder(state, { ...buy, shares: 100 }), RangeError);
    assert.throws(() => applyPaperOrder(state, { ...buy, side: "sell" }), RangeError);
    assert.throws(() => applyPaperOrder(state, { ...buy, symbol: "__proto__" }), TypeError);
    assert.throws(() => applyPaperOrder(state, { ...buy, symbol: "demo" }), TypeError);
    assert.throws(() => applyPaperOrder(state, { ...buy, side: "short" }), RangeError);
  });

  it("prevents synthetic portfolio overflow and invalid fee execution", () => {
    const state = createPaperPortfolio(100000);
    const base = { symbol: "DEMO", side: "buy", shares: 1, priceCents: 1000, expectedRevision: 0 };
    assert.throws(() => applyPaperOrder(state, { ...base, feeCents: 2000000 }), RangeError);
    assert.throws(() => applyPaperOrder(state, { ...base, priceCents: 100000001 }), RangeError);
    assert.throws(() => markPaperPortfolio(state, null), TypeError);
    assert.throws(() => markPaperPortfolio(
      applyPaperOrder(state, base), {}
    ), RangeError);
  });

  it("bounds paper orders instead of allowing limitless in-memory ledgers", () => {
    assert.equal(MAX_PAPER_ORDERS, 200);
    let state = createPaperPortfolio(100000);
    for (let i = 0; i < MAX_PAPER_ORDERS; i++) {
      state = applyPaperOrder(state, {
        symbol: "DEMO", side: i % 2 ? "sell" : "buy",
        shares: 1, priceCents: 100, expectedRevision: i
      });
    }
    assert.equal(state.history.length, MAX_PAPER_ORDERS);
    assert.throws(() => applyPaperOrder(state, {
      symbol: "DEMO", side: "buy", shares: 1, priceCents: 100,
      expectedRevision: MAX_PAPER_ORDERS
    }), /exhausted/);
  });

  it("does not accept fabricated portfolio authority", () => {
    const state = createPaperPortfolio(100);
    assert.throws(() => applyPaperOrder({ ...state, mode: "live" }, {
      symbol: "DEMO", side: "buy", shares: 1, priceCents: 50, expectedRevision: 0
    }), TypeError);
    assert.throws(() => applyPaperOrder({ ...state, virtualCashCents: -1 }, {
      symbol: "DEMO", side: "buy", shares: 1, priceCents: 50, expectedRevision: 0
    }), RangeError);
  });

  it("measures maximum peak-to-trough paper drawdown and full loss", () => {
    const d = evaluateMaxDrawdown([100, 120, 90, 130, 65]);
    assert.equal(d.maxDrawdownPoints, 65);
    assert.equal(d.maxDrawdownFraction, 0.5);
    assert.equal(evaluateMaxDrawdown([100, 0]).maxDrawdownFraction, 1);
    assert.equal(evaluateMaxDrawdown([100, 110, 130]).maxDrawdownFraction, 0);
    assert.equal(d.mode, "historical_scenario_only");
  });

  it("rejects broken drawdown observations", () => {
    assert.throws(() => evaluateMaxDrawdown([]), RangeError);
    assert.throws(() => evaluateMaxDrawdown([0, 100]), RangeError);
    assert.throws(() => evaluateMaxDrawdown([100, NaN]), RangeError);
    assert.throws(() => evaluateMaxDrawdown([100, -50]), RangeError);
    assert.throws(() => evaluateMaxDrawdown(Array(1001).fill(100)), RangeError);
  });
});
