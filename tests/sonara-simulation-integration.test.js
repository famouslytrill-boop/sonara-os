"use strict";
const assert = require("node:assert/strict");
const {
  VERSION, MAX_INPUT_BYTES, MAX_OUTPUT_BYTES,
  getStudioSimulationCatalog, evaluateInternalSimulation
} = require("../lib/sonara-simulation-integration.cjs");
const run = (studio, key, parameters) => evaluateInternalSimulation({ studio, key, parameters });

describe("cross-studio research simulation integration", () => {
  it("advertises research not production authority", () => {
    const c = getStudioSimulationCatalog();
    assert.match(VERSION, /^2026/);
    assert.equal(c.maturity, "research");
    assert.equal(c.executionEnabled, false);
    assert.equal(c.externalActionsEnabled, false);
    assert.equal(c.inputBytesLimit, MAX_INPUT_BYTES);
    assert.equal(MAX_OUTPUT_BYTES, 65536);
    assert.equal(c.capabilities.length, 13);
    assert.ok(c.capabilities.every(x => x.state === "research_only" &&
      x.customerEnabled === false && x.requiresServerAuthorization === true));
    assert.ok(c.capabilities.every(x => !Object.hasOwn(x, "runner")));
  });
  it("covers SONARA One and the three studios", () => {
    const names = new Set(getStudioSimulationCatalog().capabilities.map(x => x.studio));
    assert.deepEqual([...names].sort(),
      ["business_builder", "creator_studio", "growth_studio", "sonara_one"]);
  });
  it("filters studio capabilities without granting callable output authority", () => {
    const c = getStudioSimulationCatalog("business_builder");
    assert.equal(c.capabilities.length, 3);
    assert.ok(c.capabilities.every(x => x.studio === "business_builder"));
    assert.throws(() => getStudioSimulationCatalog("casino"), RangeError);
  });
  it("reuses Business Builder geometry and returns clear simulated labels", () => {
    const out = run("business_builder", "layout_area", {
      vertices: [[0,0], [4,0], [4,3], [0,3]]
    });
    assert.equal(out.result.absoluteArea, 12);
    assert.equal(out.actionable, false);
    assert.equal(out.calibrated, false);
    assert.equal(out.mode, "hypothetical_research_only");
  });
  it("replays hypothetical incidents with a seed", () => {
    const p = { probability: .2, impactCents: 1000, trials: 100, seed: 11 };
    assert.deepEqual(run("business_builder", "incident_scenario", p),
      run("business_builder", "incident_scenario", p));
  });
  it("reuses Creator MIDI, film, poker and board calculations", () => {
    assert.equal(run("creator_studio", "music_pitch", { midi: 69 }).result.hz, 440);
    assert.equal(run("creator_studio", "film_timeline", {
      shots: [{ id: "a", frameCount: 30 }, { id: "b", frameCount: 30 }],
      fpsNumerator: 30000, fpsDenominator: 1001
    }).result.totalFrames, 60);
    assert.equal(run("creator_studio", "poker_classification", {
      cards: ["AS","KS","QS","JS","TS"]
    }).result.kind, "straight_flush");
    assert.deepEqual(run("creator_studio", "board_minimax", {
      board: "XX.OO...."
    }).result.optimalMoves, [2]);
  });
  it("reuses Growth payoffs and bounded odds for education only", () => {
    assert.deepEqual(run("growth_studio", "strategy_payoffs", {
      matrix: [[1,-1],[-1,1]]
    }).result.rowProbabilities, [0.5, 0.5]);
    const out = run("growth_studio", "odds_calculator", {
      virtualStakePoints: 100, decimalOddsBasisPoints: 20000,
      modeledWinProbabilityPpm: 500000
    });
    assert.equal(out.result.hypotheticalExpectedNetPoints, 0);
    assert.equal(out.actionable, false);
  });
  it("runs hypothetical trend rehearsal without real market feeds", () => {
    const out = run("growth_studio", "trend_rehearsal", {
      pricesCents: [100,100,100,110,120,100], fastWindow: 2,
      slowWindow: 3, startingVirtualCashCents: 1000
    });
    assert.equal(out.result.mode, "synthetic_backtest_only");
    assert.equal(out.result.provenance, "caller_supplied_prices_no_market_feed");
  });
  it("reuses scientific probability and integration in SONARA One", () => {
    assert.equal(run("sonara_one", "card_probability", {
      deckSize: 52, successCards: 4, drawCount: 5, exactSuccesses: 1
    }).result.totalOutcomes, "2598960");
    const out = run("sonara_one", "polynomial_integral", {
      coefficients: [0,0,1], lower: 0, upper: 3, subdivisions: 100
    }).result;
    assert.equal(out.exact, 9);
    assert.ok(Math.abs(out.approximate - 9) < 1e-9);
  });
  it("rejects unlisted action keys or studio escape", () => {
    assert.throws(() => run("business_builder", "trend_rehearsal", {}), RangeError);
    assert.throws(() => run("creator_studio", "card_probability", {}), RangeError);
    assert.throws(() => run("growth_studio", "withdraw_money", {}), RangeError);
    assert.throws(() => run("sonara_one", "__proto__", {}), TypeError);
  });
  it("rejects non-JSON values and unsafe object keys", () => {
    assert.throws(() => run("creator_studio", "music_pitch", null), TypeError);
    assert.throws(() => run("creator_studio", "music_pitch", { midi: NaN }), TypeError);
    assert.throws(() => run("creator_studio", "music_pitch", { midi: () => 69 }), TypeError);
    assert.throws(() => run("creator_studio", "music_pitch",
      JSON.parse('{"__proto__":{"secret":true},"midi":69}')), TypeError);
  });
  it("enforces byte, node and depth budgets", () => {
    assert.throws(() => run("creator_studio", "music_pitch",
      { midi: 69, padding: "x".repeat(6000) }), RangeError);
    assert.throws(() => run("creator_studio", "music_pitch",
      { midi: 69, nodes: Array(601).fill(0) }), RangeError);
    assert.throws(() => run("creator_studio", "music_pitch",
      { midi: 69, chain: [[[[[[1]]]]]] }), RangeError);
  });
  it("rejects recursive and non-plain JS objects", () => {
    const cyclic = { midi: 69 }; cyclic.self = cyclic;
    assert.throws(() => run("creator_studio", "music_pitch", cyclic), TypeError);
    assert.throws(() => run("creator_studio", "music_pitch", new Date()), TypeError);
  });
  it("defers to numerical engines' domain validation", () => {
    assert.throws(() => run("creator_studio", "music_pitch", { midi: 128 }), RangeError);
    assert.throws(() => run("business_builder", "layout_area",
      { vertices: [[0,0]] }), RangeError);
    assert.throws(() => run("business_builder", "distance_2d",
      { a: [0,0], b: [Infinity,1] }), TypeError);
  });
});
