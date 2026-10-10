"use strict";
const assert = require("node:assert/strict");
const { MAX_OBSERVATIONS, MAX_TRADES, backtestSyntheticSma } =
  require("../lib/sonara-synthetic-strategy-backtest.cjs");

describe("SONARA synthetic strategy backtesting boundaries", () => {
  const inputs = () => ({
    pricesCents: [100, 100, 100, 110, 120, 130, 125, 110, 100, 100],
    fastWindow: 2, slowWindow: 3,
    startingVirtualCashCents: 1000, feeCents: 1
  });
  it("makes no live-trading or calibrated-market claims", () => {
    const r = backtestSyntheticSma(inputs());
    assert.equal(r.mode, "synthetic_backtest_only");
    assert.equal(r.provenance, "caller_supplied_prices_no_market_feed");
    assert.equal(r.executionAssumption, "previous_close_signal_next_sample_ideal_fill");
  });
  it("executes synthetic orders only after historical observations", () => {
    const r = backtestSyntheticSma(inputs());
    assert.equal(r.tradeCount, 2);
    assert.deepEqual(r.actions.map(x => [x.index, x.side]), [[4, "buy"], [8, "sell"]]);
    assert.equal(r.actions[0].assumedFillCents, 120);
  });
  it("applies whole-share cash constraints and one fee per hypothetical fill", () => {
    const r = backtestSyntheticSma(inputs());
    assert.equal(r.finalShares, 0);
    assert.equal(r.finalVirtualEquityCents, 838);
    assert.equal(r.finalVirtualCashCents, 838);
    assert.equal(r.hypotheticalBuyHoldEquityCents, 1000);
  });
  it("replays the same sequence and inputs without mutating price arrays", () => {
    const a = inputs(); const prices = [...a.pricesCents];
    assert.deepEqual(backtestSyntheticSma(a), backtestSyntheticSma(a));
    assert.deepEqual(a.pricesCents, prices);
  });
  it("does not read current or future prices to make a signal decision", () => {
    const a = inputs(); const b = inputs(); b.pricesCents[4] = 140;
    const first = backtestSyntheticSma(a).actions[0];
    const second = backtestSyntheticSma(b).actions[0];
    assert.equal(first.index, 4);
    assert.equal(second.index, 4);
    assert.equal(first.side, second.side);
  });
  it("does not force a trade when short and long moving averages tie", () => {
    const r = backtestSyntheticSma({
      pricesCents: Array(10).fill(100), fastWindow: 2, slowWindow: 3,
      startingVirtualCashCents: 1000
    });
    assert.equal(r.tradeCount, 0);
    assert.equal(r.finalShares, 0);
    assert.equal(r.returnFraction, 0);
  });
  it("does not borrow, short or buy unaffordable units", () => {
    const r = backtestSyntheticSma({
      pricesCents: [1000, 1000, 1000, 1000, 2000, 3000, 3000],
      fastWindow: 2, slowWindow: 3, startingVirtualCashCents: 100
    });
    assert.equal(r.finalShares, 0);
    assert.equal(r.tradeCount, 0);
  });
  it("rejects negative, NaN and overlong price series", () => {
    assert.equal(MAX_OBSERVATIONS, 500);
    assert.equal(MAX_TRADES, 500);
    assert.throws(() => backtestSyntheticSma({ ...inputs(), pricesCents: [] }), RangeError);
    assert.throws(() => backtestSyntheticSma({ ...inputs(), pricesCents: [100, 100, 100, NaN, 110] }), RangeError);
    assert.throws(() => backtestSyntheticSma({ ...inputs(), pricesCents: Array(501).fill(100) }), RangeError);
  });
  it("rejects invalid window spans and impossible fees", () => {
    assert.throws(() => backtestSyntheticSma({ ...inputs(), fastWindow: 4, slowWindow: 3 }), RangeError);
    assert.throws(() => backtestSyntheticSma({ ...inputs(), fastWindow: 2, slowWindow: 20 }), RangeError);
    assert.throws(() => backtestSyntheticSma({ ...inputs(), feeCents: -1 }), RangeError);
    assert.throws(() => backtestSyntheticSma({ ...inputs(), startingVirtualCashCents: 0 }), RangeError);
  });
  it("never acts earlier than the complete slow window", () => {
    const r = backtestSyntheticSma(inputs());
    assert.ok(r.actions.every(item => item.index >= r.slowWindow));
    assert.ok(r.tradeCount <= r.observations);
    assert.ok(r.maxDrawdownFraction >= 0 && r.maxDrawdownFraction <= 1);
  });
});
