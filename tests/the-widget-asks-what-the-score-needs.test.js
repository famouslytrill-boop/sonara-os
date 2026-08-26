"use strict";

// The widget's questions and the scorer's criteria are one list, seen twice.
//
// This is the file that stops the two drifting. A widget with its own question
// list and a scorer with its own criteria list agree on the day they are written
// and never again: somebody adds a question nothing scores, and the business
// spends a quarter asking it for no reason; or a criterion is added and nothing
// asks about it, so every lead reads as unanswered on it for ever while the
// page reports a confidence that is arithmetic over a question never put.
//
// Both directions are asserted, because only one of them is the obvious one.

const assert = require("node:assert/strict");
const {
  questionsFor,
  recordAnswer,
  nextStep,
  transcriptActivity,
  scorableAnswers,
  scoringQuestionKeys,
  parseMoneyToCents,
  isEmailLike,
  isPhoneLike,
  TIMELINE_CHOICES,
  OTHER_VALUE,
  CONTACT_KEY
} = require("../lib/sonara-lead-capture-script.cjs");
const { scoreLead, CRITERIA, declaredCriteria } = require("../lib/sonara-lead-scoring.cjs");

// A profile that declares every criterion there is, so the two lists can be
// compared at their fullest. If a criterion is added to the scorer and not to
// this fixture, the first test below fails -- which is the point.
const FULL_PROFILE = Object.freeze({
  industries: ["plumbing", "HVAC"],
  regions: ["UK", "IE"],
  teamSizeMin: 5,
  teamSizeMax: 200,
  budgetMinCents: 50000,
  budgetMaxCents: 500000,
  timelineDays: 90
});

describe("the capture script", () => {
  describe("asks exactly what the score reads", () => {
    it("covers every criterion the scorer declares, with nothing left over", () => {
      const declared = declaredCriteria(FULL_PROFILE);
      assert.ok(declared.length >= 4, "the fixture declares almost nothing, so this comparison is vacuous");
      assert.deepEqual(
        scoringQuestionKeys(FULL_PROFILE).slice().sort(),
        declared.slice().sort(),
        "the widget's questions and the profile's criteria have drifted apart"
      );
    });

    it("asks about nothing the scorer has never heard of", () => {
      for (const key of scoringQuestionKeys(FULL_PROFILE)) {
        assert.ok(CRITERIA.includes(key), `the widget asks about ${key} and nothing scores it`);
      }
    });

    it("stops asking about a criterion the moment the profile stops declaring it", () => {
      const withoutBudget = { ...FULL_PROFILE };
      delete withoutBudget.budgetMinCents;
      delete withoutBudget.budgetMaxCents;
      const keys = scoringQuestionKeys(withoutBudget);
      assert.ok(!keys.includes("budgetCents"), "the widget asked about a budget the profile no longer scores");
      assert.ok(keys.includes("industry"), "removing one criterion removed the others too");
    });

    it("asks only for contact details when the profile declares nothing", () => {
      const questions = questionsFor({});
      assert.equal(questions.length, 1);
      assert.equal(questions[0].key, CONTACT_KEY);
      assert.deepEqual(scoringQuestionKeys({}), []);
    });
  });

  describe("contact comes last, and is always asked", () => {
    it("puts the qualifying questions before the ask for an email", () => {
      const keys = questionsFor(FULL_PROFILE).map((question) => question.key);
      assert.equal(keys[keys.length - 1], CONTACT_KEY, "the widget asked who they were before asking anything useful");
      assert.ok(keys.length > 1);
    });

    it("asks for contact details however empty the profile is", () => {
      for (const profile of [{}, { industries: [] }, FULL_PROFILE]) {
        const keys = questionsFor(profile).map((question) => question.key);
        assert.ok(keys.includes(CONTACT_KEY), "a widget that never asks how to reply cannot produce a lead");
      }
    });
  });

  describe("what somebody typed is not coerced into an answer", () => {
    it("refuses a blank number rather than reading it as zero", () => {
      for (const blank of ["", "   ", null, undefined]) {
        const result = recordAnswer(FULL_PROFILE, "teamSize", blank);
        assert.equal(result.ok, false, `${JSON.stringify(blank)} was accepted as a team size`);
        assert.equal(result.code, "not_a_number");
      }
    });

    it("accepts a real zero, and rejects a negative", () => {
      assert.deepEqual(recordAnswer(FULL_PROFILE, "teamSize", 0), { ok: true, value: 0 });
      assert.equal(recordAnswer(FULL_PROFILE, "teamSize", -3).ok, false);
    });

    it("reads money the way a person types it, in integer cents", () => {
      assert.equal(parseMoneyToCents("1,200"), 120000);
      assert.equal(parseMoneyToCents("$1,200"), 120000);
      assert.equal(parseMoneyToCents("1200.50"), 120050);
      assert.equal(parseMoneyToCents("0"), 0);
      assert.equal(parseMoneyToCents(""), null);
      assert.equal(parseMoneyToCents("about five grand"), null);
      assert.equal(parseMoneyToCents("1.2.3"), null);
      assert.equal(recordAnswer(FULL_PROFILE, "budgetCents", "$2,000").value, 200000);
    });

    it("keeps an off-list answer as typed rather than throwing it away", () => {
      const result = recordAnswer(FULL_PROFILE, "industry", { value: OTHER_VALUE, other: "florist" });
      assert.equal(result.ok, true);
      assert.equal(result.value, "florist");
      assert.equal(result.matchedOption, false);
      // It scores as a miss, which is the truth: they answered, and the answer
      // is not what this business sells to.
      const scored = scoreLead({ profile: FULL_PROFILE, answers: { industry: "florist" }, activity: {} });
      const part = scored.perCriterion.find((entry) => entry.criterion === "industry");
      assert.equal(part.answered, true, "an off-list answer was recorded as no answer at all");
      assert.equal(part.score, 0);
    });

    it("refuses an off-list answer where the question does not allow one", () => {
      const result = recordAnswer(FULL_PROFILE, "timelineDays", { value: OTHER_VALUE, other: "whenever" });
      assert.equal(result.ok, false);
      assert.equal(result.code, "other_not_allowed");
    });

    it("turns a timeline choice into the days the scorer compares", () => {
      assert.ok(TIMELINE_CHOICES.length >= 3);
      for (const choice of TIMELINE_CHOICES) {
        const result = recordAnswer(FULL_PROFILE, "timelineDays", String(choice.days));
        assert.equal(result.ok, true, `${choice.label} was not accepted`);
        assert.equal(result.value, choice.days);
      }
    });

    it("has no question to record against a profile that does not ask it", () => {
      const result = recordAnswer({}, "industry", "plumbing");
      assert.equal(result.ok, false);
      assert.equal(result.code, "unknown_question");
    });
  });

  describe("contact details", () => {
    it("takes an email or a phone number, and insists on one of them", () => {
      assert.equal(recordAnswer(FULL_PROFILE, CONTACT_KEY, { name: "Ana", email: "ana@example.com" }).ok, true);
      assert.equal(recordAnswer(FULL_PROFILE, CONTACT_KEY, { name: "Ana", phone: "+44 7700 900123" }).ok, true);
      const neither = recordAnswer(FULL_PROFILE, CONTACT_KEY, { name: "Ana" });
      assert.equal(neither.ok, false);
      assert.equal(neither.code, "no_way_back");
    });

    it("rejects an address that is not one rather than storing a lead nobody can reach", () => {
      assert.equal(recordAnswer(FULL_PROFILE, CONTACT_KEY, { email: "ana@" }).ok, false);
      assert.equal(recordAnswer(FULL_PROFILE, CONTACT_KEY, { phone: "12" }).ok, false);
      assert.equal(isEmailLike("ana@example.com"), true);
      assert.equal(isEmailLike("ana at example"), false);
      assert.equal(isPhoneLike("+44 7700 900123"), true);
      assert.equal(isPhoneLike("123"), false);
    });

    it("does not require a name, because a reachable stranger is still a lead", () => {
      assert.equal(recordAnswer(FULL_PROFILE, CONTACT_KEY, { email: "ana@example.com" }).ok, true);
    });
  });

  describe("where the conversation is up to", () => {
    it("walks the questions in order and then stops", () => {
      const answers = {};
      const seen = [];
      for (let guard = 0; guard < 20; guard += 1) {
        const step = nextStep(FULL_PROFILE, answers);
        if (step.done) break;
        seen.push(step.question.key);
        answers[step.question.key] = step.question.key === CONTACT_KEY
          ? { email: "ana@example.com" }
          : (step.question.key === "timelineDays" ? 30 : 10);
      }
      assert.deepEqual(seen, questionsFor(FULL_PROFILE).map((question) => question.key));
      assert.equal(nextStep(FULL_PROFILE, answers).done, true);
    });

    it("is not finished when contact details are missing, however much else was answered", () => {
      const answers = { industry: "plumbing", region: "UK", teamSize: 10, budgetCents: 90000, timelineDays: 30 };
      const step = nextStep(FULL_PROFILE, answers);
      assert.equal(step.done, false);
      assert.equal(step.question.key, CONTACT_KEY);
    });

    it("does not count a contact with no way back as answered", () => {
      const answers = { [CONTACT_KEY]: { name: "Ana" } };
      const step = nextStep({}, answers);
      assert.equal(step.done, false, "a name with no email or phone finished the conversation");
    });
  });

  describe("engagement is read from the transcript", () => {
    it("counts what was actually asked rather than what could have been", () => {
      const messages = [
        { role: "assistant", questionKey: "industry" },
        { role: "visitor", text: "plumbing" },
        { role: "assistant", questionKey: "region" },
        { role: "visitor", text: "UK" }
      ];
      const activity = transcriptActivity(FULL_PROFILE, messages, { industry: "plumbing", region: "UK" });
      assert.equal(activity.questionsAsked, 2, "a visitor who left after two questions was counted as asked five");
      assert.equal(activity.questionsAnswered, 2);
      assert.equal(activity.visitorMessages, 2);
      assert.equal(activity.gaveContact, false);
    });

    it("does not read a name alone as a way of getting back to somebody", () => {
      const activity = transcriptActivity(FULL_PROFILE, [], { [CONTACT_KEY]: { name: "Ana" } });
      assert.equal(activity.gaveContact, false, "a lead with no email or phone counted as contactable");
    });

    it("reads an email as one", () => {
      const activity = transcriptActivity(FULL_PROFILE, [], { [CONTACT_KEY]: { email: "ana@example.com" } });
      assert.equal(activity.gaveContact, true);
    });

    it("survives a transcript that is missing or malformed", () => {
      for (const messages of [null, undefined, [null], [{}], "not a list"]) {
        const activity = transcriptActivity(FULL_PROFILE, messages, {});
        assert.equal(typeof activity.questionsAsked, "number");
        assert.equal(activity.questionsAnswered, 0);
      }
    });
  });

  describe("the handover to the scorer", () => {
    it("passes through every criterion and leaves contact details behind", () => {
      const answers = {
        industry: "plumbing",
        teamSize: 12,
        [CONTACT_KEY]: { name: "Ana Plumbing", email: "ana@example.com", phone: "+44 7700 900123" }
      };
      const scorable = scorableAnswers(answers);
      assert.equal(scorable.industry, "plumbing");
      assert.equal(scorable.teamSize, 12);
      assert.equal(scorable.email, undefined, "an email address was handed to the scorer");
      assert.equal(scorable.phone, undefined, "a phone number was handed to the scorer");
      assert.equal(scorable.company, "Ana Plumbing");
    });

    it("produces a score the profile can explain, end to end", () => {
      const answers = {
        industry: "plumbing",
        region: "UK",
        teamSize: 40,
        budgetCents: 200000,
        timelineDays: 30,
        [CONTACT_KEY]: { name: "Ana", email: "ana@example.com" }
      };
      const messages = questionsFor(FULL_PROFILE).map((question) => ({
        role: "assistant",
        questionKey: question.key
      }));
      const result = scoreLead({
        profile: FULL_PROFILE,
        answers: scorableAnswers(answers),
        activity: transcriptActivity(FULL_PROFILE, messages, answers)
      });
      assert.equal(result.confidence, 1, "a fully answered conversation did not produce a full confidence");
      assert.equal(result.provisional, false);
      assert.equal(result.band.key, "hot");
    });
  });
});
