// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

/** Internal research-only computation manifest; NOT authorization or production API. */
const core = require("./sonara-creative-simulation-kernel.cjs");
const math = require("./sonara-applied-game-mathematics.cjs");
const cards = require("./sonara-card-game-strategy.cjs");
const theory = require("./sonara-creative-theory-models.cjs");
const risk = require("./sonara-game-risk-paper-trading.cjs");
const strategy = require("./sonara-synthetic-strategy-backtest.cjs");
const VERSION = "2026-10-08.1";
const MAX_INPUT_BYTES = 4096;
const MAX_OUTPUT_BYTES = 65536;
const MAX_NODES = 600;
const MAX_DEPTH = 6;

function capability(studio, key, discipline, purpose, limitation, runner) {
  return Object.freeze({ studio, key, discipline, purpose, limitation,
    state: "research_only", customerEnabled: false, requiresServerAuthorization: true, runner });
}
const CAPABILITIES = Object.freeze([
  capability("business_builder", "layout_area", "geometry", "Illustrative floor and service layout areas",
    "Not CAD/building certification", p => math.polygonSignedArea(p.vertices)),
  capability("business_builder", "distance_2d", "geometry", "Cartesian distance between example locations",
    "Not GPS routing", p => ({ distance: math.distance2D(p.a, p.b) })),
  capability("business_builder", "incident_scenario", "probability", "Seeded operational hypothesis experiments",
    "Not calibrated safety/financial guidance", p => core.simulateIncidentRisk(p)),
  capability("creator_studio", "film_timeline", "film", "Frame-exact shot positioning",
    "Not a rendered film or rights grant", p => core.buildFilmTimeline(p.shots, p.fpsNumerator, p.fpsDenominator)),
  capability("creator_studio", "music_pitch", "music", "Equal-tempered MIDI note frequencies",
    "No audio recording, generation or licensing", p => ({ hz: core.midiFrequency(p.midi) })),
  capability("creator_studio", "chord_harmony", "music_theory", "Major, minor and seventh chord frequency structure",
    "No sound generation, copyrighted score or rights transfer", p => theory.studyChord(p)),
  capability("creator_studio", "narrative_beats", "story_theory", "Analyze user-authored tension beat metadata for film and literature",
    "No books ingested, story text generated or timeline mutated", p => theory.assessNarrativeBeats(p.beats)),
  capability("creator_studio", "game_physics", "simulation", "Fixed-step 2D motion rehearsal",
    "No collision engine or runtime game server", p => math.stepBody2D(p)),
  capability("creator_studio", "poker_classification", "card_games", "Classify an educational five-card hand",
    "No live casino, dealer or prize", p => cards.evaluateFiveCardHand(p.cards)),
  capability("creator_studio", "board_minimax", "game_theory", "Educational optimal board-game move search",
    "No real multiplayer authorization", p => cards.solveTicTacToe(p.board)),
  capability("growth_studio", "strategy_payoffs", "game_theory", "Hypothetical 2x2 competitive payoff strategies",
    "Payoffs are assumptions, not market evidence", p => cards.solveTwoByTwoZeroSum(p.matrix)),
  capability("growth_studio", "trend_rehearsal", "trading_education", "Synthetic historical strategy exercise",
    "Not an investment recommendation or live fill", p => strategy.backtestSyntheticSma(p)),
  capability("growth_studio", "odds_calculator", "probability", "Compare hypothesized probability and fixed odds",
    "No sportsbook, referral or payout", p => risk.evaluateHypotheticalOdds(p)),
  capability("sonara_one", "card_probability", "combinatorics", "Exact without-replacement draw probability",
    "No random casino outcome or certification", p => cards.cardDrawProbability(p)),
  capability("sonara_one", "polynomial_integral", "calculus", "Analytic and Simpson integral comparison",
    "Not a certified engineering solver", p => ({
      exact: math.integratePolynomial(p.coefficients, p.lower, p.upper),
      approximate: math.simpsonPolynomial(p.coefficients, p.lower, p.upper, p.subdivisions)
    }))
]);
const INDEX = new Map(CAPABILITIES.map(c => [c.studio + ":" + c.key, c]));

const INPUT_FIELDS = Object.freeze({
  "business_builder:layout_area": Object.freeze({ required: Object.freeze(["vertices"]), optional: Object.freeze([]) }),
  "business_builder:distance_2d": Object.freeze({ required: Object.freeze(["a", "b"]), optional: Object.freeze([]) }),
  "business_builder:incident_scenario": Object.freeze({ required: Object.freeze(["probability", "impactCents"]), optional: Object.freeze(["trials", "seed"]) }),
  "creator_studio:film_timeline": Object.freeze({ required: Object.freeze(["shots"]), optional: Object.freeze(["fpsNumerator", "fpsDenominator"]) }),
  "creator_studio:music_pitch": Object.freeze({ required: Object.freeze(["midi"]), optional: Object.freeze([]) }),
  "creator_studio:chord_harmony": Object.freeze({ required: Object.freeze(["rootMidi"]), optional: Object.freeze(["quality"]) }),
  "creator_studio:narrative_beats": Object.freeze({ required: Object.freeze(["beats"]), optional: Object.freeze([]) }),
  "creator_studio:game_physics": Object.freeze({ required: Object.freeze(["position", "velocity", "acceleration"]), optional: Object.freeze(["tickHz", "steps"]) }),
  "creator_studio:poker_classification": Object.freeze({ required: Object.freeze(["cards"]), optional: Object.freeze([]) }),
  "creator_studio:board_minimax": Object.freeze({ required: Object.freeze([]), optional: Object.freeze(["board"]) }),
  "growth_studio:strategy_payoffs": Object.freeze({ required: Object.freeze(["matrix"]), optional: Object.freeze([]) }),
  "growth_studio:trend_rehearsal": Object.freeze({ required: Object.freeze(["pricesCents"]), optional: Object.freeze(["fastWindow", "slowWindow", "startingVirtualCashCents", "feeCents"]) }),
  "growth_studio:odds_calculator": Object.freeze({ required: Object.freeze(["decimalOddsBasisPoints", "modeledWinProbabilityPpm"]), optional: Object.freeze(["virtualStakePoints"]) }),
  "sonara_one:card_probability": Object.freeze({ required: Object.freeze(["successCards", "drawCount", "exactSuccesses"]), optional: Object.freeze(["deckSize"]) }),
  "sonara_one:polynomial_integral": Object.freeze({ required: Object.freeze(["coefficients", "lower", "upper"]), optional: Object.freeze(["subdivisions"]) })
});
if (CAPABILITIES.length !== Object.keys(INPUT_FIELDS).length ||
    CAPABILITIES.some(c => !Object.hasOwn(INPUT_FIELDS, c.studio + ":" + c.key))) {
  throw new Error("research operation manifest/contract mismatch");
}

const VALID_STUDIOS = Object.freeze(["sonara_one", "business_builder", "creator_studio", "growth_studio"]);

function validateParameters(value) {
  let nodes = 0;
  const ancestors = new Set();
  function visit(v, depth) {
    if (++nodes > MAX_NODES || depth > MAX_DEPTH) throw new RangeError("complexity limit exceeded");
    if (v === null || typeof v === "boolean") return;
    if (typeof v === "number") {
      if (!Number.isFinite(v)) throw new TypeError("nonfinite input");
      return;
    }
    if (typeof v === "string") {
      if (v.length > MAX_INPUT_BYTES) throw new RangeError("string length exceeded");
      return;
    }
    if (!v || typeof v !== "object" || ancestors.has(v)) throw new TypeError("not a JSON value");
    if (!Array.isArray(v) &&
        Object.getPrototypeOf(v) !== Object.prototype &&
        Object.getPrototypeOf(v) !== null) throw new TypeError("not a plain object");
    ancestors.add(v);
    for (const key of Object.keys(v)) {
      if (["constructor", "__proto__", "prototype"].includes(key)) throw new TypeError("forbidden input key");
      visit(v[key], depth + 1);
    }
    ancestors.delete(v);
  }
  if (!value || Array.isArray(value) || typeof value !== "object") throw new TypeError("parameters must be an object");
  visit(value, 0);
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > MAX_INPUT_BYTES) {
    throw new RangeError("input byte limit exceeded");
  }
}
function getStudioSimulationCatalog(studio = null) {
  if (studio !== null && !VALID_STUDIOS.includes(studio)) throw new RangeError("unknown studio");
  return Object.freeze({
    version: VERSION, executionEnabled: false, externalActionsEnabled: false,
    maturity: "research", inputBytesLimit: MAX_INPUT_BYTES,
    capabilities: CAPABILITIES.filter(c => studio === null || c.studio === studio).map(c => ({
      studio: c.studio, key: c.key, discipline: c.discipline,
      purpose: c.purpose, limitation: c.limitation,
      state: c.state, customerEnabled: c.customerEnabled,
      requiresServerAuthorization: c.requiresServerAuthorization,
      inputFields: INPUT_FIELDS[c.studio + ":" + c.key]
    }))
  });
}
/** Pure internal computation only. Separately authenticated, rate-limited HTTP host required. */
function evaluateInternalSimulation({ studio, key, parameters }) {
  if (typeof studio !== "string" || typeof key !== "string" ||
      !/^[a-z_]{1,40}$/.test(studio) || !/^[a-z_]{1,40}$/.test(key)) {
    throw new TypeError("invalid studio/operation");
  }
  if (["__proto__", "prototype", "constructor"].includes(key)) {
    throw new TypeError("unsafe operation name");
  }
  const selected = INDEX.get(studio + ":" + key);
  if (!selected) throw new RangeError("not available for this studio");
  validateParameters(parameters);
  const contract = INPUT_FIELDS[studio + ":" + key];
  const allowed = new Set([...contract.required, ...contract.optional]);
  for (const name of Object.keys(parameters)) {
    if (!allowed.has(name)) throw new RangeError("unsupported research input field");
  }
  for (const name of contract.required) {
    if (!Object.hasOwn(parameters, name)) throw new TypeError("required research input missing");
  }
  const json = JSON.stringify(selected.runner(parameters));
  if (typeof json !== "string" || Buffer.byteLength(json, "utf8") > MAX_OUTPUT_BYTES) {
    throw new RangeError("output limit exceeded");
  }
  return Object.freeze({
    mode: "hypothetical_research_only", version: VERSION,
    studio, key, actionable: false, calibrated: false,
    limitation: selected.limitation, result: JSON.parse(json)
  });
}
module.exports = {
  VERSION, MAX_INPUT_BYTES, MAX_OUTPUT_BYTES,
  getStudioSimulationCatalog, evaluateInternalSimulation
};
