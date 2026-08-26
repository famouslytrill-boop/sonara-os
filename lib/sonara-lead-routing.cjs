"use strict";

// Deciding whose lead this is.
//
// A scored lead nobody owns is a lost lead, and it is lost quietly: it sits in
// the list looking exactly like a lead somebody is working. So the whole of this
// module is arranged around one preference -- **never leave a lead unassigned
// when there is anybody who could take it** -- and one obligation that comes
// with it: whenever the answer is not the obvious one, say so in the result
// rather than in a comment.
//
// ## The two failures this is written against
//
// **A rule that names somebody who is away.** "Send HVAC to Priya" is correct
// until Priya is on leave, and then it is a rule that routes work to nobody. The
// tempting behaviours are both wrong: stopping means the lead is never picked
// up, and silently falling through to the next rule means the business believes
// Priya is working leads she has never seen. This assigns the lead anyway, by the
// same round robin as everything else, and records `fallback` naming the rule
// that could not be honoured. Work moves, and the record is true.
//
// **A rule threshold matching a lead that has no score.** `null >= 0` is `true`
// in JavaScript, so a catch-all rule written as "score 0 or above" silently
// swallows every lead the scorer could not score. An unscored lead is not a
// zero-score lead. Score conditions here match only a lead that actually has a
// number, and a rule that wants the others has to say `unscored: true`.
//
// ## Why round robin counts open work rather than keeping a pointer
//
// A stored "next person" pointer drifts the first time somebody is added, goes
// on leave, or a row is written by hand, and nothing ever notices because a
// pointer has no truth to be checked against. Counting how many open leads each
// person is already carrying is derived from the leads themselves, so it cannot
// disagree with them. It also self-corrects: somebody back from a week off is
// behind on count and gets the next few, which is what a person would do.
//
// Ties break by the longest time since that person was last given a lead, then
// by id -- a total order, so the same inputs always produce the same answer and
// the tests are not quietly flaky.

const UNASSIGNED = Object.freeze({
  NO_PEOPLE: "no_people",
  NONE_AVAILABLE: "none_available"
});

function cleanText(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text === "" ? null : text;
}

function lowerList(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const entry of value) {
    const text = cleanText(entry);
    if (text) out.push(text.toLowerCase());
  }
  return out;
}

function finiteNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function millis(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

// Does this rule apply to this lead?
//
// Every declared condition must hold. A rule that declares nothing matches
// everything, which is what a catch-all at the bottom of the list is for -- but
// it has to be written deliberately, and `matchesRule` says so in its result so
// a page can show "catch-all" rather than leaving somebody to work out why.
function matchesRule(rule = {}, lead = {}) {
  const conditions = [];
  const when = rule.when || {};

  const score = finiteNumber(lead.score);
  const min = finiteNumber(when.minScore);
  const max = finiteNumber(when.maxScore);

  if (min !== null || max !== null) {
    // The guard the whole module exists for: an unscored lead does not satisfy
    // a numeric threshold, however low the threshold is.
    if (score === null) return { matched: false, why: "lead has no score", conditions: ["score"] };
    if (min !== null && score < min) return { matched: false, why: `score ${score} below ${min}`, conditions: ["score"] };
    if (max !== null && score > max) return { matched: false, why: `score ${score} above ${max}`, conditions: ["score"] };
    conditions.push("score");
  }

  if (when.unscored === true) {
    if (score !== null) return { matched: false, why: "lead has a score", conditions: ["unscored"] };
    conditions.push("unscored");
  }

  const bands = lowerList(when.bands);
  if (bands.length) {
    const band = cleanText(lead.band);
    if (!band || !bands.includes(band.toLowerCase())) {
      return { matched: false, why: `band ${band || "none"} not in rule`, conditions: ["band"] };
    }
    conditions.push("band");
  }

  const industries = lowerList(when.industries);
  if (industries.length) {
    const industry = cleanText(lead.industry);
    if (!industry || !industries.includes(industry.toLowerCase())) {
      return { matched: false, why: `industry ${industry || "not given"} not in rule`, conditions: ["industry"] };
    }
    conditions.push("industry");
  }

  const regions = lowerList(when.regions);
  if (regions.length) {
    const region = cleanText(lead.region);
    if (!region || !regions.includes(region.toLowerCase())) {
      return { matched: false, why: `region ${region || "not given"} not in rule`, conditions: ["region"] };
    }
    conditions.push("region");
  }

  const sources = lowerList(when.sources);
  if (sources.length) {
    const source = cleanText(lead.source);
    if (!source || !sources.includes(source.toLowerCase())) {
      return { matched: false, why: `source ${source || "not given"} not in rule`, conditions: ["source"] };
    }
    conditions.push("source");
  }

  return { matched: true, conditions, catchAll: conditions.length === 0 };
}

// Somebody is available if they are active and not marked away. Capacity is
// handled separately and deliberately does not make a person ineligible -- see
// pickByLoad.
function availablePeople(people = []) {
  return people.filter((person) => {
    if (!person || !cleanText(person.id)) return false;
    if (person.active === false) return false;
    if (person.away === true) return false;
    return true;
  });
}

// The fewest open leads wins. Capacity is a flag on the answer, not a veto: if
// everybody is full the lead still goes to whoever is least full, because an
// unassigned lead is worse than an overloaded one and the flag is how the
// business finds out it needs another person.
function pickByLoad(people, load = {}, lastAssigned = {}) {
  if (!people.length) return null;

  const ranked = people
    .map((person) => {
      const open = Math.max(0, finiteNumber(load[person.id]) ?? 0);
      const capacity = finiteNumber(person.capacity);
      return {
        person,
        open,
        capacity,
        over: capacity !== null && open >= capacity,
        // No record of a last assignment sorts as longest-waiting, which is
        // right: somebody who has never been given a lead should get one.
        last: millis(lastAssigned[person.id]) ?? 0
      };
    })
    .sort((a, b) => {
      if (a.over !== b.over) return a.over ? 1 : -1;
      if (a.open !== b.open) return a.open - b.open;
      if (a.last !== b.last) return a.last - b.last;
      return String(a.person.id).localeCompare(String(b.person.id));
    });

  return ranked[0];
}

// Route one lead.
//
//   lead         -- { score, band, industry, region, source }
//   rules        -- ordered; first match wins
//   people       -- [{ id, name, active, away, capacity }]
//   openLeads    -- { personId: count } derived from the lead table
//   lastAssigned -- { personId: timestamp }
//
// Always returns a decision. `assignedTo` is null only when there was genuinely
// nobody to give it to, and then `unassigned` says which of the two reasons it
// was -- the business has no people at all, or has people and every one of them
// is inactive or away. Those need different things done about them, so they are
// not the same answer.
function routeLead({ lead = {}, rules = [], people = [], openLeads = {}, lastAssigned = {} } = {}) {
  const available = availablePeople(people);
  const byId = new Map(available.map((person) => [String(person.id), person]));

  const evaluated = [];
  let matchedRule = null;
  for (const rule of Array.isArray(rules) ? rules : []) {
    const outcome = matchesRule(rule, lead);
    evaluated.push({ ruleId: rule && rule.id ? String(rule.id) : null, ...outcome });
    if (outcome.matched) {
      matchedRule = { rule, outcome };
      break;
    }
  }

  if (!people.length) {
    return {
      assignedTo: null,
      unassigned: {
        code: UNASSIGNED.NO_PEOPLE,
        message: "This workspace has nobody to give a lead to yet."
      },
      rule: matchedRule ? String(matchedRule.rule.id || "") || null : null,
      evaluated,
      fallback: null,
      overCapacity: false
    };
  }

  if (!available.length) {
    return {
      assignedTo: null,
      unassigned: {
        code: UNASSIGNED.NONE_AVAILABLE,
        message: "Everybody in this workspace is inactive or away, so this lead is waiting."
      },
      rule: matchedRule ? String(matchedRule.rule.id || "") || null : null,
      evaluated,
      fallback: null,
      overCapacity: false
    };
  }

  let fallback = null;
  let chosen = null;

  if (matchedRule) {
    const named = cleanText(matchedRule.rule.assignTo);
    if (named && named !== "round_robin") {
      const person = byId.get(named);
      if (person) {
        const capacity = finiteNumber(person.capacity);
        const open = Math.max(0, finiteNumber(openLeads[person.id]) ?? 0);
        chosen = { person, over: capacity !== null && open >= capacity };
      } else {
        // The failure this module was written against. The lead still moves.
        const missing = people.find((entry) => String(entry.id) === named);
        fallback = {
          from: String(matchedRule.rule.id || "") || null,
          namedPerson: named,
          why: missing
            ? "the person this rule names is inactive or away"
            : "the person this rule names is not in this workspace"
        };
      }
    }
  }

  if (!chosen) {
    const picked = pickByLoad(available, openLeads, lastAssigned);
    if (!picked) {
      return {
        assignedTo: null,
        unassigned: {
          code: UNASSIGNED.NONE_AVAILABLE,
          message: "Everybody in this workspace is inactive or away, so this lead is waiting."
        },
        rule: matchedRule ? String(matchedRule.rule.id || "") || null : null,
        evaluated,
        fallback,
        overCapacity: false
      };
    }
    chosen = { person: picked.person, over: picked.over };
  }

  return {
    assignedTo: String(chosen.person.id),
    assignedName: cleanText(chosen.person.name),
    unassigned: null,
    rule: matchedRule ? String(matchedRule.rule.id || "") || null : null,
    // True when the rule list had nothing to say and this was pure round robin.
    // Worth showing: a business whose every lead is a catch-all has not written
    // its rules yet, and the page can say so instead of implying it has.
    catchAll: matchedRule ? matchedRule.outcome.catchAll === true : true,
    evaluated,
    fallback,
    overCapacity: chosen.over === true
  };
}

module.exports = {
  routeLead,
  matchesRule,
  availablePeople,
  pickByLoad,
  UNASSIGNED
};
