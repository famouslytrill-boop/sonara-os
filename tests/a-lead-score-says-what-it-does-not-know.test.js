"use strict";

// Scoring a lead, and the difference between "no" and "did not say".
//
// lib/sonara-formula-library.cjs has always defined lead_score as
// fit + urgency + engagement - risk over four numbers it is handed, and nothing
// computed any of them. lib/sonara-lead-scoring.cjs computes them.
//
// The failure this file is mostly about is not a wrong number. It is a number
// that looks like an answer and is not: a lead who never got asked about budget
// scoring the same as a lead who said their budget was nothing, or a business
// that has filled in no profile at all being told every stranger is a perfect
// match. Both read as a working sales tool right up until somebody works the
// list in the order it gave them.

const assert = require("node:assert/strict");
const {
  scoreLead,
  scoreEngagement,
  scoreRisk,
  scoreRange,
  scoreUrgency,
  scoreMembership,
  declaredCriteria,
  finiteNumber,
  CRITERIA,
  BANDS,
  PROVISIONAL_BELOW
} = require("../lib/sonara-lead-scoring.cjs");

// A profile a real business could plausibly have written down.
const PROFILE = Object.freeze({
  industries: ["plumbing", "HVAC"],
  regions: ["UK", "IE"],
  teamSizeMin: 5,
  teamSizeMax: 200,
  budgetMinCents: 50000,
  budgetMaxCents: 500000,
  timelineDays: 90,
  disqualifiers: ["student", "competitor"]
});

const ENGAGED = Object.freeze({
  questionsAsked: 5,
  questionsAnswered: 5,
  visitorMessages: 6,
  gaveContact: true
});

describe("lead scoring", () => {
  describe("the module is actually wired to something", () => {
    it("declares the criteria it scores on, and there are several", () => {
      assert.ok(CRITERIA.length >= 4, "the criteria list has gone empty, so every check below is vacuous");
      assert.ok(BANDS.length >= 3, "the band list has gone empty");
      for (const band of BANDS) {
        assert.equal(typeof band.label, "string");
        assert.ok(band.label.trim() !== "", "a band with no label cannot be shown to anybody");
      }
    });

    it("reads every criterion the profile declares", () => {
      const declared = declaredCriteria(PROFILE);
      assert.deepEqual(declared.slice().sort(), CRITERIA.slice().sort());
    });
  });

  describe("an empty profile does not match everybody", () => {
    it("scores fit as null rather than 100 when nothing has been declared", () => {
      const result = scoreLead({
        profile: {},
        answers: { industry: "plumbing", region: "UK", teamSize: 20 },
        activity: ENGAGED
      });
      assert.equal(result.fit, null, "an empty profile matched a stranger perfectly");
      assert.equal(result.urgency, null);
      assert.deepEqual(result.declared, []);
    });

    it("still reports engagement, because the transcript happened either way", () => {
      const result = scoreLead({ profile: {}, answers: {}, activity: ENGAGED });
      assert.equal(typeof result.engagement, "number");
      assert.ok(result.engagement > 0, "somebody answered five questions and it read as no engagement");
    });

    it("names the answers it was given but has no criterion for", () => {
      const result = scoreLead({
        profile: { industries: ["plumbing"] },
        answers: { industry: "plumbing", teamSize: 12, budgetCents: 90000 },
        activity: ENGAGED
      });
      assert.ok(result.ignored.includes("teamSize"));
      assert.ok(result.ignored.includes("budgetCents"));
      assert.ok(!result.ignored.includes("industry"));
    });
  });

  describe("unanswered is not the same as answered badly", () => {
    it("leaves fit null when the lead answered none of the fit questions", () => {
      const result = scoreLead({ profile: PROFILE, answers: {}, activity: ENGAGED });
      assert.equal(result.fit, null, "a lead who said nothing was scored as though it had failed");
      assert.equal(result.answered, 0);
      assert.equal(result.confidence, 0);
    });

    it("scores a lead who answered badly below one who did not answer at all", () => {
      const silent = scoreLead({ profile: PROFILE, answers: {}, activity: ENGAGED });
      const wrong = scoreLead({
        profile: PROFILE,
        answers: { industry: "florist", region: "AU", teamSize: 1, budgetCents: 100 },
        activity: ENGAGED
      });
      assert.ok(
        wrong.score < silent.score,
        `answering everything wrong (${wrong.score}) should not beat answering nothing (${silent.score})`
      );
      assert.equal(silent.fit, null, "a lead who answered nothing was given a fit reading");
      assert.equal(typeof wrong.fit, "number");
      assert.ok(wrong.fit <= 25, `a florist of one with no budget scored ${wrong.fit} for fit`);
    });

    it("flags a high score built on nothing as provisional rather than hiding it", () => {
      // Somebody who worked through the whole widget and gave their details, but
      // whose answers told the business nothing it scores on. Engagement is real,
      // fit is unknown, and the honest reading is a high score that says so --
      // not a low score pretending the lead was assessed and failed.
      const engagedButUnknown = scoreLead({ profile: PROFILE, answers: {}, activity: ENGAGED });
      assert.equal(engagedButUnknown.fit, null);
      assert.ok(engagedButUnknown.score > 50, "real engagement was scored as though it had not happened");
      assert.equal(
        engagedButUnknown.provisional,
        true,
        "a score standing on none of the profile did not admit it was provisional"
      );
      assert.equal(engagedButUnknown.confidence, 0);
      assert.deepEqual(engagedButUnknown.componentsUsed, ["engagement"]);
    });

    it("does not read null, empty string or whitespace as a numeric answer", () => {
      for (const blank of [null, undefined, "", "   "]) {
        assert.equal(finiteNumber(blank), null, `${JSON.stringify(blank)} was read as a number`);
        const result = scoreLead({
          profile: PROFILE,
          answers: { teamSize: blank },
          activity: ENGAGED
        });
        const part = result.perCriterion.find((entry) => entry.criterion === "teamSize");
        assert.equal(part.answered, false, `a team size of ${JSON.stringify(blank)} counted as answered`);
      }
    });

    it("reads a genuine zero as an answer, because zero is a thing somebody can be", () => {
      assert.equal(finiteNumber(0), 0);
      const result = scoreLead({ profile: PROFILE, answers: { teamSize: 0 }, activity: ENGAGED });
      const part = result.perCriterion.find((entry) => entry.criterion === "teamSize");
      assert.equal(part.answered, true, "a stated team size of zero was thrown away as a blank");
    });

    it("says how much of the profile the score is standing on", () => {
      const partial = scoreLead({
        profile: PROFILE,
        answers: { industry: "plumbing" },
        activity: ENGAGED
      });
      assert.equal(partial.answered, 1);
      assert.equal(partial.confidence, 0.2);
      assert.equal(partial.provisional, true, "a score from one of five answers did not admit it was provisional");

      const full = scoreLead({
        profile: PROFILE,
        answers: { industry: "plumbing", region: "UK", teamSize: 20, budgetCents: 90000, timelineDays: 30 },
        activity: ENGAGED
      });
      assert.equal(full.confidence, 1);
      assert.equal(full.provisional, false);
      assert.ok(PROVISIONAL_BELOW > 0 && PROVISIONAL_BELOW <= 1);
    });
  });

  describe("the composite leaves out what it does not have", () => {
    it("does not count a missing component as a zero", () => {
      const withFit = scoreLead({
        profile: { industries: ["plumbing"], weights: { fit: 40, urgency: 25, engagement: 20, risk: 15 } },
        answers: { industry: "plumbing" },
        activity: ENGAGED
      });
      // Urgency is not declared, so it must not drag the composite down.
      assert.ok(!withFit.componentsUsed.includes("urgency"));
      assert.ok(withFit.componentsUsed.includes("fit"));
      assert.ok(withFit.score >= 70, `a perfect fit scored ${withFit.score}, so a missing component was counted as zero`);
    });

    it("returns a null score only when no component has a value at all", () => {
      const nothing = scoreLead({
        profile: {},
        answers: {},
        activity: { questionsAsked: 0, questionsAnswered: 0, visitorMessages: 0, gaveContact: false },
        // Engagement is always present, so drive its weight to zero to reach the
        // one state where nothing at all can be said.
      });
      const noWeights = scoreLead({
        profile: { weights: { fit: 0, urgency: 0, engagement: 0, risk: 0 } },
        answers: {},
        activity: { questionsAsked: 0, questionsAnswered: 0, visitorMessages: 0, gaveContact: false }
      });
      assert.equal(typeof nothing.score, "number");
      assert.equal(noWeights.score, null, "a score was produced from no weighted components at all");
      assert.equal(noWeights.band, null, "a band was produced for a score that does not exist");
    });

    it("never returns a score outside 0 to 100", () => {
      const extreme = scoreLead({
        profile: { ...PROFILE, weights: { fit: 1, urgency: 1, engagement: 1, risk: 400 } },
        answers: { industry: "student competitor", budgetCents: 1 },
        activity: { questionsAsked: 5, questionsAnswered: 0, visitorMessages: 0, gaveContact: false }
      });
      assert.ok(extreme.score >= 0 && extreme.score <= 100, `score ${extreme.score} left the scale`);
    });
  });

  describe("the individual readings", () => {
    it("matches membership case-insensitively and refuses a blank", () => {
      assert.equal(scoreMembership("Plumbing", ["plumbing"]), 100);
      assert.equal(scoreMembership("florist", ["plumbing"]), 0);
      assert.equal(scoreMembership("", ["plumbing"]), null);
      assert.equal(scoreMembership(null, ["plumbing"]), null);
    });

    it("scores a range full inside and falling away outside", () => {
      assert.equal(scoreRange(20, 5, 200), 100);
      assert.equal(scoreRange(5, 5, 200), 100);
      assert.equal(scoreRange(200, 5, 200), 100);
      const justUnder = scoreRange(4, 5, 200);
      const wellUnder = scoreRange(1, 5, 200);
      assert.ok(justUnder < 100, "a team below the floor scored as a perfect match");
      assert.ok(
        justUnder > wellUnder,
        `one under the floor (${justUnder}) should beat four under it (${wellUnder})`
      );
      assert.ok(wellUnder > 0, "a near miss fell straight to zero");
    });

    it("has no opinion on a range with neither end declared", () => {
      assert.equal(scoreRange(20, null, null), null);
    });

    it("scores urgency by how soon, and refuses a profile with no timeline", () => {
      assert.equal(scoreUrgency(30, 90), 100);
      assert.equal(scoreUrgency(90, 90), 100);
      const soon = scoreUrgency(120, 90);
      const later = scoreUrgency(300, 90);
      assert.ok(soon > later, `sooner (${soon}) must outrank later (${later})`);
      assert.equal(scoreUrgency(30, null), null, "urgency was scored against a timeline nobody set");
      assert.equal(scoreUrgency(null, 90), null);
      assert.equal(scoreUrgency(-5, 90), null, "a negative timeline was treated as an answer");
    });

    it("reads engagement from the transcript, not from what was claimed", () => {
      const finished = scoreEngagement({ questionsAsked: 5, questionsAnswered: 5, visitorMessages: 6, gaveContact: true });
      const left = scoreEngagement({ questionsAsked: 5, questionsAnswered: 1, visitorMessages: 1, gaveContact: false });
      assert.ok(finished > left, `finishing (${finished}) must outrank leaving (${left})`);
      assert.equal(scoreEngagement({}), 0);
      assert.ok(finished <= 100);
    });

    it("raises a risk flag for each thing actually observed, and none otherwise", () => {
      const clean = scoreRisk(PROFILE, { industry: "plumbing", budgetCents: 90000 }, { gaveContact: true });
      assert.equal(clean.score, 0);
      assert.deepEqual(clean.flags, []);

      const dirty = scoreRisk(
        PROFILE,
        { industry: "plumbing", notes: "I am a student", budgetCents: 100 },
        { gaveContact: false }
      );
      const codes = dirty.flags.map((flag) => flag.code).sort();
      assert.deepEqual(codes, ["disqualifier", "no_contact", "under_budget"]);
      assert.ok(dirty.score > 0);
      for (const flag of dirty.flags) {
        assert.ok(flag.detail && flag.detail.trim() !== "", "a risk flag with no detail cannot be explained to anybody");
      }
    });

    it("raises no disqualifier risk when the profile named none", () => {
      const risk = scoreRisk({}, { notes: "I am a student" }, { gaveContact: true });
      assert.deepEqual(risk.flags, [], "a term was treated as a disqualifier without the business declaring it");
      assert.equal(risk.score, 0);
    });
  });

  describe("the ordering a person would actually work", () => {
    it("puts an ideal, engaged, contactable lead above everything else", () => {
      const ideal = scoreLead({
        profile: PROFILE,
        answers: { industry: "plumbing", region: "UK", teamSize: 40, budgetCents: 200000, timelineDays: 14 },
        activity: ENGAGED
      });
      const marginal = scoreLead({
        profile: PROFILE,
        answers: { industry: "plumbing", region: "AU", teamSize: 2, budgetCents: 60000, timelineDays: 300 },
        activity: { questionsAsked: 5, questionsAnswered: 3, visitorMessages: 3, gaveContact: true }
      });
      const bad = scoreLead({
        profile: PROFILE,
        answers: { industry: "florist", region: "AU", teamSize: 1, budgetCents: 100, notes: "competitor" },
        activity: { questionsAsked: 5, questionsAnswered: 2, visitorMessages: 2, gaveContact: false }
      });

      assert.ok(ideal.score > marginal.score, `${ideal.score} vs ${marginal.score}`);
      assert.ok(marginal.score > bad.score, `${marginal.score} vs ${bad.score}`);
      assert.equal(ideal.band.key, "hot");
      assert.equal(ideal.provisional, false);
    });

    it("gives every scored lead a band, and every band a name", () => {
      for (const answers of [{}, { industry: "plumbing" }, { industry: "florist", teamSize: 1 }]) {
        const result = scoreLead({ profile: PROFILE, answers, activity: ENGAGED });
        assert.ok(result.band, "a scored lead came back with no band");
        assert.ok(result.band.label.trim() !== "");
      }
    });
  });
});
