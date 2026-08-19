"use strict";

// Whether the calls somebody made were any good, scored properly.
//
// The idea is NotFair's (MIT, reviewed in data/open-source-tools.ts); the
// implementation is original and deliberately keeps only the half that measures.
// NotFair runs agents that act around the clock whether you are watching or not,
// and AGENTS.md puts customer campaigns behind owner approval -- so this scores
// and reports, and a person decides.
//
// The properties below are properties of the scoring rules rather than of this
// code, which is the point: a Brier score has known values for known inputs, and
// a proper scoring rule is one where honesty scores best. Both are checkable
// without trusting anything written here.

const assert = require("node:assert/strict");
const science = require("../lib/sonara-goal-science.cjs");
const { goalTracker, parsePredictionLines } = require("../lib/sonara-planner-tools.cjs");

function calls(pairs) {
  return pairs.map(([predicted, outcome], index) => ({ label: `Call ${index}`, predicted, outcome: outcome ? "yes" : "no" }));
}

describe("scoring a call you already made", () => {
  describe("reading what somebody typed", () => {
    it("takes a probability however it was written", () => {
      assert.equal(science.probabilityFrom("70%"), 0.7);
      assert.equal(science.probabilityFrom("70"), 0.7);
      assert.equal(science.probabilityFrom("0.7"), 0.7);
      assert.equal(science.probabilityFrom(" 0.7 "), 0.7);
      // A bare 1 is read as certainty rather than one per cent. Somebody typing
      // it in a confidence box means the first far more often than the second.
      assert.equal(science.probabilityFrom("1"), 1);
      assert.equal(science.probabilityFrom("0"), 0);
    });

    it("refuses what is not a probability", () => {
      for (const bad of ["", " ", "quite sure", "-10", "150", "abc", null, undefined]) {
        assert.equal(science.probabilityFrom(bad), null, `accepted ${JSON.stringify(bad)}`);
      }
    });

    it("treats an unrecorded outcome as unknown, never as a miss", () => {
      // Absent is not false. Counting an unsettled call as wrong punishes
      // somebody for predictions whose outcome nobody knows yet.
      assert.equal(science.outcomeFrom("yes"), 1);
      assert.equal(science.outcomeFrom("no"), 0);
      assert.equal(science.outcomeFrom(""), null);
      assert.equal(science.outcomeFrom(" "), null);
      assert.equal(science.outcomeFrom(null), null);
      assert.equal(science.outcomeFrom("maybe"), null);
    });

    it("keeps a call whose outcome nobody has recorded, and names it", () => {
      const result = science.scorePredictions([
        ...calls([[0.9, true], [0.8, true], [0.7, true], [0.6, false], [0.5, true]]),
        { label: "Still open", predicted: "50", outcome: "" }
      ]);
      assert.equal(result.ok, true);
      assert.equal(result.scored, 5, "the unsettled call was scored");
      assert.deepEqual(result.unresolved, ["Still open"]);
    });

    it("reads a line whose outcome has not been filled in yet", () => {
      // "Still open, 50," has a trailing empty field. Dropping it turns the call
      // into one with no confidence, which reads back as "we could not
      // understand this" instead of "this one has not settled".
      const rows = parsePredictionLines("Ad A beats B, 80%, yes\nStill open, 50,");
      assert.equal(rows.length, 2);
      assert.deepEqual(rows[0], { label: "Ad A beats B", predicted: "80%", outcome: "yes" });
      assert.equal(rows[1].label, "Still open");
      assert.equal(rows[1].predicted, "50");
      assert.equal(rows[1].outcome, "");
    });
  });

  describe("the score itself", () => {
    it("gives the values a Brier score is defined to give", () => {
      // Perfect: certain and right every time.
      assert.equal(science.scorePredictions(calls([[1, true], [1, true], [1, true], [1, true], [1, true]])).brier, 0);
      // Certain and wrong every time is the worst a Brier score goes.
      assert.equal(science.scorePredictions(calls([[1, false], [1, false], [1, false], [1, false], [1, false]])).brier, 1);
      // "Even chance" about everything is 0.25, whatever happens.
      const coin = science.scorePredictions(calls([[0.5, true], [0.5, false], [0.5, true], [0.5, false], [0.5, true]]));
      assert.ok(Math.abs(coin.brier - 0.25) < 1e-12, `even-chance scored ${coin.brier}`);
    });

    it("rewards honesty, which is what makes it worth using", () => {
      // The defining property of a proper scoring rule: over events that happen
      // 70% of the time, saying 70% beats saying anything else. A rule without
      // this rewards hedging, and hedging is what a hit-rate table rewards.
      const outcomes = [true, true, true, true, true, true, true, false, false, false];
      const scoreFor = (stated) =>
        science.scorePredictions(outcomes.map((outcome, index) => ({ label: `c${index}`, predicted: stated, outcome: outcome ? "yes" : "no" }))).brier;
      const honest = scoreFor(0.7);
      for (const other of [0.5, 0.6, 0.8, 0.9, 1, 0.3]) {
        assert.ok(honest <= scoreFor(other) + 1e-12, `stating ${other} scored better than stating the truth`);
      }
    });

    it("says when the calls carry no more information than the overall hit rate", () => {
      // Somebody who says the same number to everything is perfectly calibrated
      // on average and has told you nothing case by case. A hit-rate table
      // cannot see that; this has to.
      const flat = science.scorePredictions(calls([[0.6, true], [0.6, true], [0.6, true], [0.6, false], [0.6, false]]));
      assert.equal(flat.ok, true);
      assert.equal(flat.beatsBaseRate, false, "saying one number to everything was reported as informative");
      assert.ok(Math.abs(flat.resolution) < 1e-12, `resolution should be zero for a flat forecaster, was ${flat.resolution}`);
    });

    it("says when they do", () => {
      const sharp = science.scorePredictions(calls([[0.95, true], [0.9, true], [0.9, true], [0.1, false], [0.05, false]]));
      assert.equal(sharp.beatsBaseRate, true, "calls that tracked the outcomes were not reported as informative");
      assert.ok(sharp.skill > 0.5, `skill came out at ${sharp.skill}`);
      assert.ok(sharp.resolution > 0.1, "a forecaster who separated the outcomes was scored as having no resolution");
    });

    it("spots somebody who is too sure, and somebody who is not sure enough", () => {
      const tooSure = science.scorePredictions(calls([[0.9, true], [0.9, false], [0.9, false], [0.9, true], [0.9, false]]));
      assert.ok(tooSure.overconfidence > 0.2, `overconfidence came out at ${tooSure.overconfidence}`);
      const notSureEnough = science.scorePredictions(calls([[0.3, true], [0.3, true], [0.3, true], [0.3, true], [0.3, false]]));
      assert.ok(notSureEnough.overconfidence < -0.2, `underconfidence came out at ${notSureEnough.overconfidence}`);
    });

    it("never returns an infinite log score, however certain somebody was", () => {
      // The log score of a confident miss is mathematically infinite, which is
      // correct and useless on a page. The clamp is stated in the output rather
      // than hidden.
      const result = science.scorePredictions(calls([[1, false], [1, false], [0, true], [0, true], [1, false]]));
      assert.ok(Number.isFinite(result.logScore), `log score came out ${result.logScore}`);
      assert.equal(result.logScoreClamp, science.LOG_SCORE_CLAMP);
    });

    it("refuses to score too few calls", () => {
      const result = science.scorePredictions(calls([[0.8, true], [0.6, false]]));
      assert.equal(result.ok, false);
      assert.equal(result.code, "not_enough_predictions");
      assert.match(result.message, new RegExp(String(science.MINIMUM_PREDICTIONS)));
    });

    it("puts every scored call in exactly one calibration band", () => {
      const result = science.scorePredictions(calls([[0.05, false], [0.3, false], [0.5, true], [0.7, true], [0.95, true], [1, true]]));
      assert.equal(result.ok, true);
      const counted = result.bands.reduce((sum, band) => sum + band.count, 0);
      assert.equal(counted, result.scored, `${counted} calls landed in bands against ${result.scored} scored`);
      // Including 1.0, which an upper bound of exactly 1 would drop silently.
      assert.ok(result.bands[result.bands.length - 1].count >= 2, "a call of 100% fell outside every band");
    });
  });

  describe("whether the goal is on track", () => {
    it("measures a goal that goes up", () => {
      const result = science.goalProgress({ baseline: 100, current: 130, target: 200, daysElapsed: 30, daysTotal: 90 });
      assert.equal(result.ok, true);
      assert.ok(Math.abs(result.progress - 0.3) < 1e-12);
      assert.equal(result.onTrack, false, "30% of the way with a third of the time gone is behind, not ahead");
      assert.ok(Math.abs(result.requiredRatePerDay - (70 / 60)) < 1e-9);
    });

    it("measures a goal that goes down, without calling progress a loss", () => {
      // "Cut cost per lead from 50 to 30" moves downward and is progress. An
      // unsigned distance would report it as going backwards.
      const result = science.goalProgress({ baseline: 50, current: 38, target: 30, daysElapsed: 45, daysTotal: 90 });
      assert.equal(result.ok, true);
      assert.ok(result.progress > 0, `a downward goal reported ${result.progress} progress`);
      assert.equal(result.onTrack, true);
      assert.equal(result.reached, false);
    });

    it("knows when the target has been reached, in either direction", () => {
      assert.equal(science.goalProgress({ baseline: 100, current: 210, target: 200, daysElapsed: 40, daysTotal: 90 }).reached, true);
      assert.equal(science.goalProgress({ baseline: 50, current: 28, target: 30, daysElapsed: 40, daysTotal: 90 }).reached, true);
    });

    it("refuses the arithmetic that has no answer", () => {
      assert.equal(science.goalProgress({ baseline: 100, current: 130, target: 100, daysElapsed: 30, daysTotal: 90 }).code, "target_equals_baseline");
      assert.equal(science.goalProgress({ baseline: 100, current: 130, target: 200, daysElapsed: 30, daysTotal: 0 }).code, "window_required");
      assert.equal(science.goalProgress({ baseline: 100, current: 130, target: 200, daysElapsed: 120, daysTotal: 90 }).code, "window_impossible");
      assert.equal(science.goalProgress({ baseline: null, current: 130, target: 200, daysElapsed: 30, daysTotal: 90 }).code, "numbers_required");
    });

    it("says nothing rather than dividing by no days left", () => {
      const result = science.goalProgress({ baseline: 100, current: 180, target: 200, daysElapsed: 90, daysTotal: 90 });
      assert.equal(result.ok, true);
      assert.equal(result.requiredRatePerDay, null, "a rate over zero remaining days is not a number anybody can act on");
    });
  });

  describe("the page a customer fills in", () => {
    it("works the goal out without any predictions at all", () => {
      const output = goalTracker({ baseline: "100", current: "130", target: "200", daysElapsed: "30", daysTotal: "90" });
      assert.ok(!output.couldNotCalculate, output.couldNotCalculate);
      assert.match(output.howFarAlong, /30% of the way/);
      assert.match(output.onTrackOrNot, /Behind a straight line/);
      assert.equal(output.howGoodYourCallsAre, undefined, "a goal with no predictions was scored anyway");
    });

    it("tells somebody plainly when their confidence is not tracking reality", () => {
      const output = goalTracker({
        baseline: "100", current: "130", target: "200", daysElapsed: "30", daysTotal: "90",
        predictions: ["A, 60, yes", "B, 60, yes", "C, 60, yes", "D, 60, no", "E, 60, no"].join("\n")
      });
      assert.match(output.againstKnowingNothing, /No better than simply saying/i);
    });

    it("says what the score is against, never a bare number", () => {
      const output = goalTracker({
        baseline: "100", current: "130", target: "200", daysElapsed: "30", daysTotal: "90",
        predictions: ["A, 95, yes", "B, 90, yes", "C, 90, yes", "D, 10, no", "E, 5, no"].join("\n")
      });
      // A score with nothing beside it is a number somebody either ignores or
      // over-reads. The comparison is the whole point of showing it.
      assert.match(output.howGoodYourCallsAre, /lower is better/i);
      assert.match(output.againstKnowingNothing, /Better than simply saying/i);
      assert.match(output.tooSureOrNotSureEnough, /confidence/i);
    });

    it("tells them to write the call down before the move, not after", () => {
      const output = goalTracker({ baseline: "100", current: "130", target: "200", daysElapsed: "30", daysTotal: "90" });
      assert.match(output.nextAction, /before you make the move/i);
    });
  });

  describe("nothing here acts on anything", () => {
    it("has no write, no send and no schedule in the module", () => {
      // AGENTS.md puts customer campaigns behind owner approval, and the source
      // this idea came from runs agents around the clock. The half that was
      // taken is the half that measures -- asserted, because a boundary in a
      // comment is what stops being true first.
      // Comments stripped first. The module's own header explains why campaigns
      // are behind owner approval, and a check that matched that sentence would
      // fail on the documentation of the rule it is enforcing -- which is how a
      // check teaches people to delete the explanation.
      const raw = require("node:fs").readFileSync(require.resolve("../lib/sonara-goal-science.cjs"), "utf8");
      const source = raw.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
      assert.ok(source.length > 1000, "stripping comments left nothing to check");
      assert.doesNotMatch(source, /\bfetch\s*\(/, "the goal module reaches the network");
      assert.doesNotMatch(source, /\brequire\s*\(/, "the goal module pulls in a dependency");
      for (const word of ["setInterval", "setTimeout", "cron", "schedule", "sendEmail", "campaign"]) {
        assert.ok(!new RegExp(word, "i").test(source), `the goal module references ${word}`);
      }
    });
  });
});
