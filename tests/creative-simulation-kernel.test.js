"use strict";

const assert = require("node:assert/strict");
const {
  MAX_TRIALS,
  createSeededRng,
  simulateIncidentRisk,
  analyzeZeroSumGame,
  shortestGridPath,
  midiFrequency,
  beatSeconds,
  buildFilmTimeline,
  createTurnState,
  applyScoreTurn
} = require("../lib/sonara-creative-simulation-kernel.cjs");

describe("SONARA creative simulation kernel (non-production)", () => {
  it("replays a seeded random stream without ambient randomness", () => {
    const a = createSeededRng(42);
    const b = createSeededRng(42);
    assert.deepEqual([a.next(), a.next(), a.snapshot()], [b.next(), b.next(), b.snapshot()]);
    assert.notEqual(createSeededRng(43).next(), createSeededRng(42).next());
    assert.throws(() => createSeededRng(0), RangeError);
  });

  it("replays incident simulations and reports expected versus sampled losses", () => {
    const input = { probability: 0.25, impactCents: 12500, trials: 1000, seed: 113 };
    const one = simulateIncidentRisk(input);
    assert.deepEqual(one, simulateIncidentRisk(input));
    assert.equal(one.modeledExpectedLossCents, 3125);
    assert.ok(one.incidents >= 0 && one.incidents <= 1000);
    assert.equal(one.empiricalProbability, one.incidents / 1000);
    assert.equal(one.simulatedMeanLossCents, 12500 * one.incidents / 1000);
    assert.ok(Object.isFrozen(one));
  });

  it("handles zero and certain incident probability without false random events", () => {
    assert.equal(simulateIncidentRisk({ probability: 0, impactCents: 500, trials: 100 }).incidents, 0);
    assert.equal(simulateIncidentRisk({ probability: 1, impactCents: 500, trials: 100 }).incidents, 100);
  });

  it("rejects unbounded or maliciously invalid simulation input", () => {
    assert.equal(MAX_TRIALS, 10000);
    assert.throws(() => simulateIncidentRisk({ probability: NaN, impactCents: 1 }), RangeError);
    assert.throws(() => simulateIncidentRisk({ probability: 1.01, impactCents: 1 }), RangeError);
    assert.throws(() => simulateIncidentRisk({ probability: 0.1, impactCents: -1 }), RangeError);
    assert.throws(() => simulateIncidentRisk({ probability: 0.1, impactCents: 3, trials: 10001 }), RangeError);
  });

  it("locates the pure saddle in a zero-sum payoff matrix", () => {
    const outcome = analyzeZeroSumGame([[4, 2], [3, 1]]);
    assert.equal(outcome.maximin, 2);
    assert.equal(outcome.minimax, 2);
    assert.equal(outcome.hasPureEquilibrium, true);
    assert.deepEqual(outcome.pureEquilibria, [{ row: 0, column: 1, value: 2 }]);
  });

  it("does not fabricate a pure solution where mixed play is required", () => {
    const matchingPennies = analyzeZeroSumGame([[1, -1], [-1, 1]]);
    assert.equal(matchingPennies.hasPureEquilibrium, false);
    assert.deepEqual(matchingPennies.pureEquilibria, []);
    assert.equal(matchingPennies.maximin, -1);
    assert.equal(matchingPennies.minimax, 1);
  });

  it("rejects ragged, empty, oversized and non-finite game payoffs", () => {
    assert.throws(() => analyzeZeroSumGame([]), RangeError);
    assert.throws(() => analyzeZeroSumGame([[1], [1, 2]]), TypeError);
    assert.throws(() => analyzeZeroSumGame([[Infinity]]), RangeError);
    assert.throws(() => analyzeZeroSumGame(Array.from({ length: 33 }, () => [0])), RangeError);
  });

  it("finds a deterministic shortest path around blocked cells", () => {
    const input = { width: 3, height: 3, blocked: [[1, 0], [1, 1]], start: [0, 0], goal: [2, 2] };
    const result = shortestGridPath(input);
    assert.equal(result.reachable, true);
    assert.equal(result.steps, 4);
    assert.deepEqual(result.path, [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]]);
    assert.deepEqual(shortestGridPath(input), result);
  });

  it("handles unreachable or malformed grids safely", () => {
    assert.deepEqual(shortestGridPath({
      width: 3, height: 1, start: [0, 0], goal: [2, 0], blocked: [[1, 0]]
    }), { reachable: false, steps: null, path: [] });
    assert.throws(() => shortestGridPath({
      width: 2, height: 2, start: [0, 0], goal: [1, 1], blocked: [[0, 0]]
    }), RangeError);
    assert.throws(() => shortestGridPath({
      width: 1, height: 1, start: [0, 0], goal: [3, 0]
    }), RangeError);
  });

  it("converts music theory pitch and beat without audio-side effects", () => {
    assert.equal(midiFrequency(69), 440);
    assert.equal(midiFrequency(81), 880);
    assert.equal(beatSeconds(4, 120), 2);
    assert.equal(beatSeconds(3, 90), 2);
    assert.throws(() => midiFrequency(128), RangeError);
    assert.throws(() => beatSeconds(1, 0), RangeError);
  });

  it("retains integral frames across fractional fps film edits", () => {
    const result = buildFilmTimeline([
      { id: "intro", frameCount: 30 },
      { id: "outro", frameCount: 30 }
    ], 30000, 1001);
    assert.equal(result.totalFrames, 60);
    assert.equal(result.shots[0].startFrame, 0);
    assert.equal(result.shots[0].endFrame, result.shots[1].startFrame);
    assert.equal(result.shots[1].endFrame, 60);
    assert.equal(result.seconds, 60 * 1001 / 30000);
  });

  it("rejects duplicate shot IDs and invalid frame counts", () => {
    assert.throws(() => buildFilmTimeline([{ id: "a", frameCount: 0 }]), RangeError);
    assert.throws(() => buildFilmTimeline([{ id: "a", frameCount: 10 }, { id: "a", frameCount: 10 }]), RangeError);
    assert.throws(() => buildFilmTimeline([{ id: "../bad", frameCount: 1 }]), TypeError);
    assert.throws(() => buildFilmTimeline([{ id: "a", frameCount: 5 }], 0), RangeError);
  });

  it("applies immutable, revision-checked alternating score turns", () => {
    const start = createTurnState(["alice", "bob"]);
    const one = applyScoreTurn(start, { actor: "alice", points: 7, expectedRevision: 0 });
    const two = applyScoreTurn(one, { actor: "bob", points: 3, expectedRevision: 1 });
    assert.equal(start.revision, 0);
    assert.deepEqual(start.scores, { alice: 0, bob: 0 });
    assert.deepEqual(two.scores, { alice: 7, bob: 3 });
    assert.equal(two.turn, 2);
  });

  it("freezes new board states and rejects corrupted or forged revision state", () => {
    const original = createTurnState(["alice", "bob"]);
    assert.ok(Object.isFrozen(original));
    assert.ok(Object.isFrozen(original.players));
    assert.ok(Object.isFrozen(original.scores));
    assert.throws(() => createTurnState(["__proto__", "bob"]), TypeError);
    const first = applyScoreTurn(original, { actor: "alice", points: 1, expectedRevision: 0 });
    assert.ok(Object.isFrozen(first));
    assert.ok(Object.isFrozen(first.players));
    assert.ok(Object.isFrozen(first.scores));
    assert.throws(() => applyScoreTurn(
      { ...first, turn: 0 },
      { actor: "alice", points: 1, expectedRevision: 1 }
    ), /invalid or exhausted/);
    assert.throws(() => applyScoreTurn(
      { ...first, scores: { alice: 1, bob: 0, injected: 7 } },
      { actor: "bob", points: 1, expectedRevision: 1 }
    ), /invalid or exhausted/);
    assert.throws(() => applyScoreTurn(
      { ...first, scores: { alice: 1 } },
      { actor: "bob", points: 1, expectedRevision: 1 }
    ), /invalid or exhausted/);
    assert.throws(() => applyScoreTurn(
      { ...first, scores: { alice: 1, bob: NaN } },
      { actor: "bob", points: 1, expectedRevision: 1 }
    ), /invalid or exhausted/);
  });

  it("rejects score overflow at the moment the turn occurs", () => {
    const start = createTurnState(["alice", "bob"]);
    assert.throws(() => applyScoreTurn(
      { ...start, scores: { alice: 100000, bob: 0 } },
      { actor: "alice", points: 1, expectedRevision: 0 }
    ), RangeError);
    assert.throws(() => applyScoreTurn(
      { ...start, scores: { alice: -100000, bob: 0 } },
      { actor: "alice", points: -1, expectedRevision: 0 }
    ), RangeError);
  });

  it("rejects stale revisions, out-of-turn moves, duplicate IDs and excess points", () => {
    const start = createTurnState(["alice", "bob"]);
    assert.throws(() => createTurnState(["alice", "alice"]), RangeError);
    assert.throws(() => applyScoreTurn(start, { actor: "alice", points: 3, expectedRevision: 1 }), /revision conflict/);
    assert.throws(() => applyScoreTurn(start, { actor: "bob", points: 3, expectedRevision: 0 }), /not current player/);
    assert.throws(() => applyScoreTurn(start, { actor: "alice", points: 101, expectedRevision: 0 }), RangeError);
    assert.throws(() => applyScoreTurn({ ...start, turn: 1000 }, { actor: "alice", points: 2, expectedRevision: 0 }), /invalid or exhausted/);
  });
});
