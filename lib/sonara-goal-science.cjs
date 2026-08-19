"use strict";

// Whether the moves you made actually did what you said they would.
//
// Taken as an idea from NotFair (MIT, reviewed in data/open-source-tools.ts) and
// written from scratch. Its README describes turning an ambition stated in plain
// language into a metric with a measured baseline, and then running a loop that
// scores its past moves against what it predicted. **The scoring half is the
// part worth having, and it is arithmetic.** The acting half is what AGENTS.md
// refuses: customer campaigns need owner approval, and "around the clock,
// whether you are watching or not" is exactly the thing that rule exists to
// stop. So this measures and reports, and a person decides.
//
// Same terms as the other two science modules here: no model call, no provider,
// no network, no cost per use, same inputs always the same answer.
//
// ## Why a scoring rule rather than "were you right"
//
// Counting how often somebody was right rewards never committing. Predict 50%
// on everything and you are never very wrong; predict 90% and get it right nine
// times in ten and a hit-rate table cannot tell you that was better. A **proper
// scoring rule** is one where the best score comes from stating what you
// actually believe, and both of the rules below are proper.
//
// The Brier score is the mean squared error of a probability against the outcome
// (1 or 0). Lower is better, 0 is perfect, 0.25 is what you get by saying 50% to
// everything, and 1 is confidently wrong every time.
//
// The logarithmic score is harsher: being certain and wrong is infinitely bad.
// That is mathematically correct and useless on a page, so predictions are
// clamped away from 0 and 1 before it is taken -- and the clamp is stated in the
// output rather than hidden, because a number whose derivation is invisible is a
// number nobody can check.

const LOG_SCORE_CLAMP = 0.001;
const MINIMUM_PREDICTIONS = 5;

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// A probability, however it was typed. People write 70, 0.7 and "70%" for the
// same belief, and refusing two of those is refusing most of the input.
//
// The ambiguity is real and is resolved deliberately: 1 could be 100% or could
// be 1%. It is read as 100%, because somebody typing a bare 1 in a confidence
// box means certainty far more often than they mean one in a hundred.
function probabilityFrom(value) {
  const raw = String(value == null ? "" : value).trim().replace(/%$/, "");
  const parsed = finiteNumber(raw);
  if (parsed === null) return null;
  if (parsed < 0) return null;
  if (parsed <= 1) return parsed;
  if (parsed <= 100) return parsed / 100;
  return null;
}

// Did it happen? Absent is not false, so an unresolved prediction is dropped
// from the scoring rather than counted as a miss -- counting it would punish
// somebody for predictions whose outcome is not known yet.
function outcomeFrom(value) {
  const raw = String(value == null ? "" : value).trim().toLowerCase();
  if (["yes", "y", "true", "1", "hit", "happened", "met"].includes(raw)) return 1;
  if (["no", "n", "false", "0", "miss", "missed", "not met"].includes(raw)) return 0;
  return null;
}

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

// How well calibrated somebody is, in buckets they can act on.
//
// Ten buckets would be precise and mostly empty for a small business making a
// prediction a week. Five is the coarsest split that still separates "I say
// 90% and mean it" from "I say 90% about everything".
const CALIBRATION_BANDS = Object.freeze([
  { low: 0, high: 0.2, label: "Under 20%" },
  { low: 0.2, high: 0.4, label: "20-40%" },
  { low: 0.4, high: 0.6, label: "40-60%" },
  { low: 0.6, high: 0.8, label: "60-80%" },
  { low: 0.8, high: 1.0000001, label: "Over 80%" }
]);

function calibration(scored) {
  return CALIBRATION_BANDS.map((band) => {
    const inBand = scored.filter((entry) => entry.predicted >= band.low && entry.predicted < band.high);
    if (!inBand.length) return { ...band, count: 0, saidOnAverage: null, happened: null, gap: null };
    const saidOnAverage = inBand.reduce((sum, entry) => sum + entry.predicted, 0) / inBand.length;
    const happened = inBand.reduce((sum, entry) => sum + entry.outcome, 0) / inBand.length;
    return { ...band, count: inBand.length, saidOnAverage, happened, gap: saidOnAverage - happened };
  });
}

/**
 * Score a list of predictions against what actually happened.
 * @param {Array<{label?: string, predicted: number|string, outcome: unknown}>} rawPredictions
 */
function scorePredictions(rawPredictions) {
  const entries = [];
  const unresolved = [];
  const unusable = [];
  for (const raw of Array.isArray(rawPredictions) ? rawPredictions : []) {
    const label = String(raw?.label || "").trim() || "Unnamed prediction";
    const predicted = probabilityFrom(raw?.predicted);
    const outcome = outcomeFrom(raw?.outcome);
    if (predicted === null) {
      unusable.push(label);
      continue;
    }
    // Absent is not false. A prediction whose outcome nobody has recorded is
    // held out and named, never scored as a miss.
    if (outcome === null) {
      unresolved.push(label);
      continue;
    }
    entries.push({ label, predicted, outcome });
  }

  if (entries.length < MINIMUM_PREDICTIONS) {
    return {
      ok: false,
      code: "not_enough_predictions",
      unresolved,
      unusable,
      message: `${MINIMUM_PREDICTIONS} settled predictions are the fewest worth scoring. ${entries.length} of the ones given had both a confidence and a recorded outcome.`
    };
  }

  const brier = entries.reduce((sum, entry) => sum + (entry.predicted - entry.outcome) ** 2, 0) / entries.length;
  const logScore = entries.reduce((sum, entry) => {
    const p = clamp(entry.predicted, LOG_SCORE_CLAMP, 1 - LOG_SCORE_CLAMP);
    return sum + Math.log(entry.outcome === 1 ? p : 1 - p);
  }, 0) / entries.length;

  // The base rate is what a forecaster who knew nothing but the overall hit rate
  // would say every time. Its Brier score is the bar this has to clear -- a
  // score that cannot beat it is a score that knew nothing case by case.
  const baseRate = entries.reduce((sum, entry) => sum + entry.outcome, 0) / entries.length;
  const baseRateBrier = entries.reduce((sum, entry) => sum + (baseRate - entry.outcome) ** 2, 0) / entries.length;

  // Murphy's decomposition, the two halves worth telling apart:
  //   * reliability -- when you say 70%, does it happen 70% of the time?
  //   * resolution  -- do you say different numbers for things that turn out
  //                    differently, or the same number for everything?
  // A forecaster who always says the base rate is perfectly reliable and has
  // zero resolution, which is exactly the failure a hit-rate table cannot see.
  const bands = calibration(entries);
  const reliability = bands
    .filter((band) => band.count > 0)
    .reduce((sum, band) => sum + (band.count / entries.length) * (band.saidOnAverage - band.happened) ** 2, 0);
  const resolution = bands
    .filter((band) => band.count > 0)
    .reduce((sum, band) => sum + (band.count / entries.length) * (band.happened - baseRate) ** 2, 0);

  const overconfidence = entries.reduce((sum, entry) => sum + (entry.predicted - entry.outcome), 0) / entries.length;

  return {
    ok: true,
    scored: entries.length,
    unresolved,
    unusable,
    brier,
    logScore,
    baseRate,
    baseRateBrier,
    // Positive means better than knowing only the overall hit rate.
    skill: baseRateBrier > 0 ? (baseRateBrier - brier) / baseRateBrier : null,
    beatsBaseRate: brier < baseRateBrier,
    reliability,
    resolution,
    // Positive means saying higher numbers than events deserved.
    overconfidence,
    bands,
    logScoreClamp: LOG_SCORE_CLAMP,
    basis: "your own settled predictions only. It knows nothing about why any of them went the way they did."
  };
}

// Where a goal is against where it started and where it is going.
//
// Deliberately not a forecast: lib/sonara-operations-science.cjs already does
// that properly with a trend and an error bar. This answers the simpler question
// somebody actually asks -- am I on track for the date I set?
function goalProgress({ baseline, current, target, daysElapsed, daysTotal } = {}) {
  const from = finiteNumber(baseline);
  const now = finiteNumber(current);
  const to = finiteNumber(target);
  const elapsed = finiteNumber(daysElapsed);
  const total = finiteNumber(daysTotal);
  if (from === null || now === null || to === null) {
    return { ok: false, code: "numbers_required", message: "A baseline, where it is now, and a target are all needed before any of this means anything." };
  }
  if (to === from) {
    return { ok: false, code: "target_equals_baseline", message: "The target is the same as the baseline, so there is no movement to measure." };
  }
  if (elapsed === null || total === null || total <= 0) {
    return { ok: false, code: "window_required", message: "How many days the goal runs for, and how many have passed, are both needed to say whether it is on track." };
  }
  if (elapsed < 0 || elapsed > total) {
    return { ok: false, code: "window_impossible", message: "The days elapsed have to sit between zero and the length of the goal." };
  }

  // Signed on purpose. "Cut cost per lead to $30" moves down and is progress;
  // dividing by an unsigned distance would call that going backwards.
  const distance = to - from;
  const moved = now - from;
  const progress = moved / distance;
  const timeUsed = elapsed / total;
  const expected = timeUsed;

  return {
    ok: true,
    progress,
    timeUsed,
    // Where it would be if it moved at a steady rate. Not a prediction -- a line.
    expected,
    aheadBy: progress - expected,
    onTrack: progress >= expected,
    // What the remaining days need to look like. Null when there are none left,
    // because a rate over zero days is a division nobody can act on.
    requiredRatePerDay: total - elapsed > 0 ? ((to - now) / (total - elapsed)) : null,
    achievedRatePerDay: elapsed > 0 ? moved / elapsed : null,
    reached: distance > 0 ? now >= to : now <= to,
    basis: "a straight line from the baseline to the target. Real progress is rarely straight, and a goal behind at the halfway point is not a goal lost."
  };
}

module.exports = {
  CALIBRATION_BANDS,
  LOG_SCORE_CLAMP,
  MINIMUM_PREDICTIONS,
  calibration,
  finiteNumber,
  goalProgress,
  outcomeFrom,
  probabilityFrom,
  scorePredictions
};
