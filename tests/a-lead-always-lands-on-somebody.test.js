"use strict";

// Whose lead is this, and what happens when the answer is awkward.
//
// The failure mode here is quiet. An unassigned lead sits in the list looking
// exactly like a lead somebody is working, so a routing bug does not show up as
// an error -- it shows up months later as a pipeline that was never worked. Most
// of this file is therefore about the awkward cases rather than the happy one:
// a rule naming somebody on leave, a threshold meeting a lead that has no score,
// everybody already at capacity.

const assert = require("node:assert/strict");
const { routeLead, matchesRule, availablePeople, pickByLoad, UNASSIGNED } = require("../lib/sonara-lead-routing.cjs");

const PEOPLE = Object.freeze([
  { id: "p-ana", name: "Ana", active: true, capacity: 10 },
  { id: "p-ben", name: "Ben", active: true, capacity: 10 },
  { id: "p-cal", name: "Cal", active: true, capacity: 10 }
]);

describe("lead routing", () => {
  describe("the fixture is capable of failing", () => {
    it("has more than one person, so round robin has something to choose between", () => {
      assert.ok(PEOPLE.length >= 3, "the people fixture has gone empty, so every check below is vacuous");
      assert.equal(availablePeople(PEOPLE).length, PEOPLE.length);
    });
  });

  describe("an unscored lead does not satisfy a numeric threshold", () => {
    it("refuses a score rule for a lead with no score, however low the floor", () => {
      // null >= 0 is true in JavaScript. A catch-all written as "score 0 or
      // above" would otherwise swallow every lead the scorer could not score.
      const rule = { id: "r-any", when: { minScore: 0 }, assignTo: "p-ana" };
      const outcome = matchesRule(rule, { score: null });
      assert.equal(outcome.matched, false, "a rule with a floor of zero matched a lead with no score at all");
      assert.match(outcome.why, /no score/);
    });

    it("matches an unscored lead only when the rule asks for one", () => {
      const rule = { id: "r-unscored", when: { unscored: true }, assignTo: "p-ben" };
      assert.equal(matchesRule(rule, { score: null }).matched, true);
      assert.equal(matchesRule(rule, { score: 40 }).matched, false);
    });

    it("still matches a genuine score of zero, which is a real reading", () => {
      const rule = { id: "r-any", when: { minScore: 0 }, assignTo: "p-ana" };
      assert.equal(matchesRule(rule, { score: 0 }).matched, true);
    });

    it("routes an unscored lead to somebody rather than dropping it", () => {
      const decision = routeLead({
        lead: { score: null },
        rules: [{ id: "r-hot", when: { minScore: 75 }, assignTo: "p-ana" }],
        people: PEOPLE
      });
      assert.ok(decision.assignedTo, "a lead with no score was left with nobody to work it");
      assert.equal(decision.rule, null, "an unscored lead was recorded as matching a score rule");
      assert.equal(decision.catchAll, true);
    });
  });

  describe("a rule that names somebody who is away", () => {
    const rules = [{ id: "r-hvac", when: { industries: ["hvac"] }, assignTo: "p-ana" }];

    it("honours the rule when that person is here", () => {
      const decision = routeLead({ lead: { industry: "HVAC" }, rules, people: PEOPLE });
      assert.equal(decision.assignedTo, "p-ana");
      assert.equal(decision.rule, "r-hvac");
      assert.equal(decision.fallback, null);
    });

    it("still assigns the lead when that person is away, and says which rule could not be honoured", () => {
      const away = [{ ...PEOPLE[0], away: true }, PEOPLE[1], PEOPLE[2]];
      const decision = routeLead({ lead: { industry: "HVAC" }, rules, people: away });

      assert.ok(decision.assignedTo, "a rule naming somebody on leave routed the lead to nobody");
      assert.notEqual(decision.assignedTo, "p-ana", "a lead was assigned to somebody marked away");
      assert.ok(decision.fallback, "the lead was rerouted and the record does not say so");
      assert.equal(decision.fallback.from, "r-hvac");
      assert.equal(decision.fallback.namedPerson, "p-ana");
      assert.match(decision.fallback.why, /inactive or away/);
      // The rule is still recorded as the one that matched. It did match; it
      // just could not be honoured, and those are different facts.
      assert.equal(decision.rule, "r-hvac");
    });

    it("says something different when the rule names somebody who is not here at all", () => {
      const decision = routeLead({
        lead: { industry: "HVAC" },
        rules: [{ id: "r-hvac", when: { industries: ["hvac"] }, assignTo: "p-ghost" }],
        people: PEOPLE
      });
      assert.ok(decision.assignedTo);
      assert.match(decision.fallback.why, /not in this workspace/);
    });
  });

  describe("round robin counts open work", () => {
    it("gives the next lead to whoever is carrying the least", () => {
      const decision = routeLead({
        lead: {},
        rules: [],
        people: PEOPLE,
        openLeads: { "p-ana": 7, "p-ben": 2, "p-cal": 5 }
      });
      assert.equal(decision.assignedTo, "p-ben");
    });

    it("treats somebody who has never been given a lead as longest waiting", () => {
      const decision = routeLead({
        lead: {},
        rules: [],
        people: PEOPLE,
        openLeads: { "p-ana": 0, "p-ben": 0, "p-cal": 0 },
        lastAssigned: { "p-ana": "2026-08-01T00:00:00Z", "p-cal": "2026-08-20T00:00:00Z" }
      });
      assert.equal(decision.assignedTo, "p-ben", "somebody who has never had a lead was not first in line");
    });

    it("is deterministic when everything ties", () => {
      const inputs = { lead: {}, rules: [], people: PEOPLE, openLeads: {}, lastAssigned: {} };
      const first = routeLead(inputs).assignedTo;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        assert.equal(routeLead(inputs).assignedTo, first, "the same inputs gave two different answers");
      }
    });

    it("does not read a missing count as anything other than none carried", () => {
      const decision = routeLead({
        lead: {},
        rules: [],
        people: PEOPLE,
        openLeads: { "p-ana": 4, "p-ben": 4 }
      });
      assert.equal(decision.assignedTo, "p-cal", "a person with no row was not treated as carrying nothing");
    });
  });

  describe("capacity is a flag, not a veto", () => {
    it("still assigns when everybody is full, and says so", () => {
      const decision = routeLead({
        lead: {},
        rules: [],
        people: PEOPLE,
        openLeads: { "p-ana": 10, "p-ben": 12, "p-cal": 11 }
      });
      assert.ok(decision.assignedTo, "every person being full left the lead with nobody");
      assert.equal(decision.assignedTo, "p-ana", "the least full person was not the one picked");
      assert.equal(decision.overCapacity, true, "an over-capacity assignment did not admit it");
    });

    it("prefers somebody under capacity over somebody with fewer leads but full", () => {
      const people = [
        { id: "p-ana", name: "Ana", active: true, capacity: 2 },
        { id: "p-ben", name: "Ben", active: true, capacity: 50 }
      ];
      const decision = routeLead({ lead: {}, rules: [], people, openLeads: { "p-ana": 2, "p-ben": 9 } });
      assert.equal(decision.assignedTo, "p-ben");
      assert.equal(decision.overCapacity, false);
    });

    it("does not flag capacity for somebody who has none set", () => {
      const people = [{ id: "p-solo", name: "Solo", active: true }];
      const decision = routeLead({ lead: {}, rules: [], people, openLeads: { "p-solo": 400 } });
      assert.equal(decision.assignedTo, "p-solo");
      assert.equal(decision.overCapacity, false, "an unset capacity was read as a capacity of zero");
    });
  });

  describe("the two ways there is genuinely nobody", () => {
    it("says so when the workspace has no people at all", () => {
      const decision = routeLead({ lead: {}, rules: [], people: [] });
      assert.equal(decision.assignedTo, null);
      assert.equal(decision.unassigned.code, UNASSIGNED.NO_PEOPLE);
      assert.ok(decision.unassigned.message.trim() !== "");
    });

    it("says something different when everybody is away", () => {
      const decision = routeLead({
        lead: {},
        rules: [],
        people: PEOPLE.map((person) => ({ ...person, away: true }))
      });
      assert.equal(decision.assignedTo, null);
      assert.equal(decision.unassigned.code, UNASSIGNED.NONE_AVAILABLE);
      assert.notEqual(
        decision.unassigned.message,
        "This workspace has nobody to give a lead to yet.",
        "two different problems were reported with the same sentence"
      );
    });

    it("never reports an unassigned lead without a reason", () => {
      for (const people of [[], PEOPLE.map((person) => ({ ...person, active: false }))]) {
        const decision = routeLead({ lead: {}, rules: [], people });
        assert.equal(decision.assignedTo, null);
        assert.ok(decision.unassigned, "a lead came back unassigned with nothing said about why");
        assert.ok(Object.values(UNASSIGNED).includes(decision.unassigned.code));
      }
    });
  });

  describe("first match wins, and the record shows the working", () => {
    it("stops at the first matching rule", () => {
      const decision = routeLead({
        lead: { score: 90, band: "hot", industry: "hvac" },
        rules: [
          { id: "r-cold", when: { maxScore: 20 }, assignTo: "p-cal" },
          { id: "r-hot", when: { minScore: 75 }, assignTo: "p-ana" },
          { id: "r-hvac", when: { industries: ["hvac"] }, assignTo: "p-ben" }
        ],
        people: PEOPLE
      });
      assert.equal(decision.rule, "r-hot");
      assert.equal(decision.assignedTo, "p-ana");
      assert.equal(decision.evaluated.length, 2, "rules after the match were still evaluated");
      assert.equal(decision.evaluated[0].matched, false);
      assert.ok(decision.evaluated[0].why, "a rule was rejected with no reason recorded");
    });

    it("marks a rule that declares no conditions as the catch-all it is", () => {
      const decision = routeLead({
        lead: { score: 50 },
        rules: [{ id: "r-all", when: {}, assignTo: "round_robin" }],
        people: PEOPLE
      });
      assert.equal(decision.catchAll, true);
      assert.equal(decision.rule, "r-all");
    });

    it("matches industry and region case-insensitively and refuses a blank", () => {
      assert.equal(matchesRule({ when: { regions: ["uk"] } }, { region: "UK" }).matched, true);
      assert.equal(matchesRule({ when: { regions: ["uk"] } }, { region: "" }).matched, false);
      assert.equal(matchesRule({ when: { regions: ["uk"] } }, {}).matched, false);
    });
  });

  describe("pickByLoad on its own", () => {
    it("returns nothing for an empty list rather than throwing", () => {
      assert.equal(pickByLoad([], {}, {}), null);
    });
  });
});
