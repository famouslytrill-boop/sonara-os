// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

/**
 * Dependency-free, pure research/sandbox primitives. No DB, network, payment,
 * customer data, side effects, or production activation.
 * Floating point metrics are illustrative, never settlement arithmetic.
 */
const MAX_TRIALS = 10000;
const MAX_CELLS = 4096;

function integer(value, name, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(name + " must be an integer between " + min + " and " + max);
  }
  return value;
}
function finite(value, name, min, max) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(name + " must be finite and between " + min + " and " + max);
  }
  return value;
}
function identifier(value, name) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(value)) {
    throw new TypeError(name + " must be a 1-64 character identifier");
  }
  return value;
}

function createSeededRng(seed) {
  let state = integer(seed, "seed", 1, 0xffffffff) >>> 0;
  return Object.freeze({
    next() {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return (state >>> 0) / 0x100000000;
    },
    snapshot() { return state >>> 0; }
  });
}

/** Scenario experiment only. A single Bernoulli loss is not a financial VaR model. */
function simulateIncidentRisk({ probability, impactCents, trials = 1000, seed = 1 }) {
  finite(probability, "probability", 0, 1);
  integer(impactCents, "impactCents", 0, 1_000_000_000);
  integer(trials, "trials", 1, MAX_TRIALS);
  const rng = createSeededRng(seed);
  let incidents = 0;
  for (let i = 0; i < trials; i++) {
    if (rng.next() < probability) incidents++;
  }
  return Object.freeze({
    seed, trials, incidents,
    empiricalProbability: incidents / trials,
    modeledExpectedLossCents: probability * impactCents,
    simulatedMeanLossCents: incidents * impactCents / trials
  });
}

/** Row player maximizes; column player minimizes. Pure equilibria only. */
function analyzeZeroSumGame(payoffs) {
  if (!Array.isArray(payoffs) || payoffs.length < 1 || payoffs.length > 32 ||
      !Array.isArray(payoffs[0]) || payoffs[0].length < 1 || payoffs[0].length > 32) {
    throw new RangeError("payoffs must be a 1..32 by 1..32 matrix");
  }
  const columns = payoffs[0].length;
  const matrix = payoffs.map((row, r) => {
    if (!Array.isArray(row) || row.length !== columns) throw new TypeError("ragged payoff row " + r);
    return row.map((v, c) => finite(v, "payoff " + r + "," + c, -1e9, 1e9));
  });
  const rowMinima = matrix.map(row => Math.min(...row));
  const columnMaxima = Array.from({ length: columns }, (_, c) => Math.max(...matrix.map(row => row[c])));
  const maximin = Math.max(...rowMinima);
  const minimax = Math.min(...columnMaxima);
  const pureEquilibria = [];
  if (Math.abs(maximin - minimax) <= 1e-9) {
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < columns; c++) {
        if (Math.abs(matrix[r][c] - maximin) <= 1e-9 &&
            Math.abs(rowMinima[r] - maximin) <= 1e-9 &&
            Math.abs(columnMaxima[c] - minimax) <= 1e-9) {
          pureEquilibria.push({ row: r, column: c, value: matrix[r][c] });
        }
      }
    }
  }
  return { maximin, minimax, rowMinima, columnMaxima, pureEquilibria,
    hasPureEquilibrium: pureEquilibria.length > 0 };
}

function shortestGridPath({ width, height, blocked = [], start, goal }) {
  integer(width, "width", 1, 64);
  integer(height, "height", 1, 64);
  if (width * height > MAX_CELLS) throw new RangeError("grid too large");
  function cell(point, name) {
    if (!Array.isArray(point) || point.length !== 2) throw new TypeError(name + " must be [x,y]");
    const x = integer(point[0], name + ".x", 0, width - 1);
    const y = integer(point[1], name + ".y", 0, height - 1);
    return y * width + x;
  }
  if (!Array.isArray(blocked) || blocked.length > width * height) throw new RangeError("blocked must fit grid");
  const obstacles = new Set(blocked.map((p, i) => cell(p, "blocked[" + i + "]")));
  const source = cell(start, "start");
  const target = cell(goal, "goal");
  if (obstacles.has(source) || obstacles.has(target)) throw new RangeError("start/goal cannot be blocked");
  const previous = new Map([[source, null]]);
  const queue = [source];
  for (let i = 0; i < queue.length && !previous.has(target); i++) {
    const index = queue[i];
    const x = index % width;
    const y = Math.floor(index / width);
    // Fixed neighbor order ensures equal-length paths replay identically.
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const next = ny * width + nx;
      if (obstacles.has(next) || previous.has(next)) continue;
      previous.set(next, index);
      queue.push(next);
    }
  }
  if (!previous.has(target)) return { reachable: false, steps: null, path: [] };
  const path = [];
  for (let at = target; at !== null; at = previous.get(at)) {
    path.push([at % width, Math.floor(at / width)]);
  }
  path.reverse();
  return { reachable: true, steps: path.length - 1, path };
}

function midiFrequency(midi, a4Hz = 440) {
  integer(midi, "midi", 0, 127);
  finite(a4Hz, "a4Hz", 400, 480);
  return a4Hz * 2 ** ((midi - 69) / 12);
}
function beatSeconds(beat, bpm) {
  finite(beat, "beat", 0, 1_000_000);
  finite(bpm, "bpm", 1, 400);
  return 60 * beat / bpm;
}

/** All edits occur in integer frames; endFrame is exclusive. Not drop-frame timecode. */
function buildFilmTimeline(shots, fpsNumerator = 24, fpsDenominator = 1) {
  integer(fpsNumerator, "fpsNumerator", 1, 120000);
  integer(fpsDenominator, "fpsDenominator", 1, 1001);
  if (!Array.isArray(shots) || shots.length < 1 || shots.length > 256) {
    throw new RangeError("shots must contain 1..256 entries");
  }
  const seen = new Set();
  let cursor = 0;
  const timeline = shots.map((shot, i) => {
    if (!shot || typeof shot !== "object" || Array.isArray(shot)) throw new TypeError("invalid shot " + i);
    const id = identifier(shot.id, "shots[" + i + "].id");
    if (seen.has(id)) throw new RangeError("duplicate shot id " + id);
    seen.add(id);
    const frameCount = integer(shot.frameCount, "frameCount", 1, 10_000_000);
    const startFrame = cursor;
    cursor += frameCount;
    return Object.freeze({ id, startFrame, endFrame: cursor, frameCount });
  });
  return Object.freeze({
    fpsNumerator, fpsDenominator,
    totalFrames: cursor,
    seconds: cursor * fpsDenominator / fpsNumerator,
    shots: timeline
  });
}

/** Minimal score-based turn reducer for simulation, NOT authentication or a game server. */
function createTurnState(players) {
  if (!Array.isArray(players) || players.length < 2 || players.length > 8) {
    throw new RangeError("players must contain 2..8 identifiers");
  }
  const ids = players.map((p, i) => identifier(p, "player " + i));
  if (new Set(ids).size !== ids.length) throw new RangeError("player identifiers must be unique");
  if (ids.some(p => ["__proto__", "constructor", "prototype"].includes(p))) {
    throw new TypeError("reserved player identifier");
  }
  return Object.freeze({
    players: Object.freeze(ids), revision: 0, turn: 0,
    scores: Object.freeze(Object.fromEntries(ids.map(id => [id, 0])))
  });
}
function applyScoreTurn(state, { actor, points, expectedRevision }) {
  if (!state || !Array.isArray(state.players) || !Number.isSafeInteger(state.revision) ||
      !Number.isSafeInteger(state.turn) || state.turn < 0 || state.turn >= 1000 ||
      state.revision !== state.turn ||
      state.players.length < 2 || state.players.length > 8 ||
      new Set(state.players).size !== state.players.length ||
      !state.players.every(p => typeof p === "string" &&
        /^[a-zA-Z0-9_-]{1,64}$/.test(p) &&
        !["__proto__", "constructor", "prototype"].includes(p)) ||
      !state.scores || typeof state.scores !== "object" ||
      Array.isArray(state.scores) ||
      (Object.getPrototypeOf(state.scores) !== Object.prototype &&
       Object.getPrototypeOf(state.scores) !== null) ||
      Object.keys(state.scores).length !== state.players.length ||
      !state.players.every(p => Object.hasOwn(state.scores, p) &&
        Number.isSafeInteger(state.scores[p]) &&
        state.scores[p] >= -100000 && state.scores[p] <= 100000)) {
    throw new TypeError("invalid or exhausted turn state");
  }
  integer(expectedRevision, "expectedRevision", 0, 1000);
  integer(points, "points", -100, 100);
  if (state.revision !== expectedRevision) throw new Error("revision conflict");
  const nextActor = state.players[state.turn % state.players.length];
  if (actor !== nextActor) throw new Error("actor not current player");
  const currentScore = state.scores[actor];
  const nextScore = integer(currentScore + points, "next score", -100000, 100000);
  return Object.freeze({
    players: Object.freeze([...state.players]), revision: state.revision + 1,
    turn: state.turn + 1,
    scores: Object.freeze({ ...state.scores, [actor]: nextScore })
  });
}

module.exports = {
  MAX_TRIALS, createSeededRng, simulateIncidentRisk, analyzeZeroSumGame,
  shortestGridPath, midiFrequency, beatSeconds, buildFilmTimeline,
  createTurnState, applyScoreTurn
};
