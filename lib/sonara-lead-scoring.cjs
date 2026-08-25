"use strict";

// The four numbers the lead_score formula has always been handed.
//
// lib/sonara-formula-library.cjs has carried this since the library was built:
//
//   lead_score = fit_score + urgency_score + engagement_score - risk_score
//
// **All four are inputs.** Adding four numbers together is not lead scoring;
// working out what they are is. Nothing in this product computed any of them, so
// the formula has been arithmetic over figures somebody typed, dressed as a
// model. This is the same shape as reorder_point taking safety_stock as an
// input, which lib/sonara-inventory-science.cjs exists to answer.
//
// This module computes all four from an ideal customer profile the business
// wrote down and the answers a lead actually gave. No model call, no provider,
// no network, no cost per use.
//
// ## The rule that matters more than the arithmetic
//
// **An unanswered question is not a bad answer.** A lead who was asked about
// budget and said "under 500" is a poor fit. A lead who was never asked, or who
// left before answering, is *unknown* -- and if unknown scores as zero, every
// lead who leaves early looks like a lead who does not qualify, which is the
// exact opposite of the truth about somebody who arrived and started typing.
//
// So `fit` and `urgency` are `null` when nothing was answered, never 0, and
// every score travels with a `confidence` saying how much of the profile was
// actually filled in. A page showing 82 without showing "1 of 5 answered" is
// reporting a success that is not true.
//
// **An empty profile does not match everything.** If the business has declared
// no criteria, `fit` is `null` rather than 100. A check satisfied by an empty
// list is this codebase's signature defect, and a vacuous perfect fit on every
// stranger who opens the widget would be that defect wearing a sales number.
//
// ## What is deliberately not here
//
// No enrichment from third-party data. "Enrich" on a sales page usually means
// buying a contact database, which is a per-record cost and a consent question,
// and this product does not have an answer to either. What a lead told you about
// itself is the data this scores. Everything it knows, it was told.

const CRITERIA = Object.freeze(["industry", "region", "teamSize", "budgetCents", "timelineDays"]);

const DEFAULT_WEIGHTS = Object.freeze({ fit: 40, urgency: 25, engagement: 20, risk: 15 });

// Bands are cut points on a 0-100 composite, named the way somebody working a
// list would name them. They are not a confidence statement -- see `provisional`.
const BANDS = Object.freeze([
  { key: "hot", label: "Hot", from: 75 },
  { key: "warm", label: "Warm", from: 50 },
  { key: "nurture", label: "Nurture", from: 25 },
  { key: "cold", label: "Cold", from: 0 }
]);

// Below this share of the profile answered, a band is a guess wearing a label.
const PROVISIONAL_BELOW = 0.5;

// Number(null) is 0, Number("") is 0, and Number(" ") is 0. Every one of those
// would make an unanswered question read as an answer of zero, which is the
// thing this module exists not to do.
function finiteNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function cleanText(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text === "" ? null : text;
}

function textList(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  for (const entry of value) {
    const text = cleanText(entry);
    if (text) seen.add(text.toLowerCase());
  }
  return Array.from(seen);
}

// A profile is only as declared as the criteria it actually names. A range with
// neither end is not a range, and an empty list is not a filter.
function declaredCriteria(profile = {}) {
  const declared = [];
  if (textList(profile.industries).length) declared.push("industry");
  if (textList(profile.regions).length) declared.push("region");
  if (finiteNumber(profile.teamSizeMin) !== null || finiteNumber(profile.teamSizeMax) !== null) {
    declared.push("teamSize");
  }
  if (finiteNumber(profile.budgetMinCents) !== null || finiteNumber(profile.budgetMaxCents) !== null) {
    declared.push("budgetCents");
  }
  if (finiteNumber(profile.timelineDays) !== null) declared.push("timelineDays");
  return declared;
}

// Membership scores 100 or 0 rather than something in between, because "we sell
// to plumbers" and "this is a florist" has no partial credit in it.
function scoreMembership(answer, allowed) {
  const text = cleanText(answer);
  if (text === null) return null;
  return allowed.includes(text.toLowerCase()) ? 100 : 0;
}

// A range scores full inside, and falls away outside it rather than dropping to
// zero at the edge: a team of four against a floor of five is not the same
// prospect as a team of one.
//
// **The fall is proportional to the boundary, not to the width of the range.**
// The first version of this tapered over one range-width, which meant a wide
// profile barely penalised anything: a team of one against a 5-200 range scored
// 98, because one is close to five *on the scale of 195*. It is not close to
// five on the scale of five. Proportional distance says a team of four is at
// four fifths of the floor and a team of one is at one fifth, which is what
// somebody looking at the two leads would say.
//
// Being over the ceiling is scored the same way and is usually the softer miss:
// a business twice the size of the profile is off-target, not disqualified.
function scoreRange(answer, min, max) {
  const value = finiteNumber(answer);
  if (value === null) return null;
  const low = finiteNumber(min);
  const high = finiteNumber(max);
  if (low === null && high === null) return null;
  if ((low === null || value >= low) && (high === null || value <= high)) return 100;

  if (low !== null && value < low) {
    // A floor of zero cannot be undershot by anything non-negative, so reaching
    // here means the value is negative -- which is not a smaller business, it is
    // not a business.
    if (low <= 0 || value <= 0) return 0;
    return Math.round(Math.max(0, Math.min(100, (value / low) * 100)));
  }

  if (high !== null && value > high) {
    if (high <= 0 || value <= 0) return 0;
    return Math.round(Math.max(0, Math.min(100, (high / value) * 100)));
  }

  return 0;
}

// Sooner is more urgent. A lead wanting it inside the profile's own timeline is
// at 100; one wanting it at four times that is at 0. "Someday" is not urgency,
// and neither is a blank.
function scoreUrgency(answerDays, profileDays) {
  const wanted = finiteNumber(answerDays);
  if (wanted === null || wanted < 0) return null;
  const target = finiteNumber(profileDays);
  if (target === null || target <= 0) return null;
  if (wanted <= target) return 100;
  const span = target * 3;
  const over = wanted - target;
  return Math.max(0, Math.round(100 - (over / span) * 100));
}

// Engagement is the one score that is always observable, because it is measured
// from the transcript rather than from what anybody said. It is not null when a
// lead answered nothing -- answering nothing *is* the engagement reading.
function scoreEngagement(activity = {}) {
  const asked = Math.max(0, finiteNumber(activity.questionsAsked) ?? 0);
  const answered = Math.max(0, finiteNumber(activity.questionsAnswered) ?? 0);
  const replies = Math.max(0, finiteNumber(activity.visitorMessages) ?? 0);

  // Reaching the end of a five-question script is the strong signal; sending
  // more messages than questions is somebody typing rather than clicking.
  const completion = asked > 0 ? Math.min(1, answered / asked) : 0;
  const talked = Math.min(1, replies / 6);
  const contact = activity.gaveContact === true ? 1 : 0;

  const score = completion * 60 + talked * 15 + contact * 25;
  return Math.round(Math.max(0, Math.min(100, score)));
}

// Risk is what should stop somebody picking this lead up, and it subtracts. Only
// things actually observed count: a profile that named no disqualifiers produces
// no disqualifier risk, which is a true zero rather than an unevaluated one.
function scoreRisk(profile = {}, answers = {}, activity = {}) {
  const flags = [];
  const disqualifiers = textList(profile.disqualifiers);
  if (disqualifiers.length) {
    const haystack = [answers.industry, answers.region, answers.notes, answers.company]
      .map((value) => cleanText(value))
      .filter((value) => value !== null)
      .join(" ")
      .toLowerCase();
    for (const term of disqualifiers) {
      if (haystack.includes(term)) flags.push({ code: "disqualifier", detail: term, points: 40 });
    }
  }

  const budget = finiteNumber(answers.budgetCents);
  const floor = finiteNumber(profile.budgetMinCents);
  if (budget !== null && floor !== null && budget < floor) {
    flags.push({ code: "under_budget", detail: "stated budget is below the profile floor", points: 25 });
  }

  if (activity.gaveContact !== true) {
    flags.push({ code: "no_contact", detail: "no way to reply was given", points: 20 });
  }

  const total = flags.reduce((sum, flag) => sum + flag.points, 0);
  return { score: Math.min(100, total), flags };
}

// The composite. Components with no value are left out of both the numerator and
// the denominator rather than counted as zero, so a lead who answered only the
// urgency question is scored on urgency and engagement -- not scored as though
// it had failed every other question.
function composite(parts, weights) {
  const positives = [
    { key: "fit", value: parts.fit, weight: finiteNumber(weights.fit) ?? 0 },
    { key: "urgency", value: parts.urgency, weight: finiteNumber(weights.urgency) ?? 0 },
    { key: "engagement", value: parts.engagement, weight: finiteNumber(weights.engagement) ?? 0 }
  ].filter((part) => part.value !== null && part.weight > 0);

  if (!positives.length) return { score: null, used: [] };

  const weighted = positives.reduce((sum, part) => sum + part.value * part.weight, 0);
  const divisor = positives.reduce((sum, part) => sum + part.weight, 0);
  const earned = weighted / divisor;

  const riskWeight = finiteNumber(weights.risk) ?? 0;
  const penalty = riskWeight > 0 ? (parts.risk / 100) * riskWeight : 0;

  const score = Math.max(0, Math.min(100, Math.round(earned - penalty)));
  return { score, used: positives.map((part) => part.key) };
}

function bandFor(score) {
  if (score === null) return null;
  for (const band of BANDS) {
    if (score >= band.from) return { key: band.key, label: band.label };
  }
  return { key: BANDS[BANDS.length - 1].key, label: BANDS[BANDS.length - 1].label };
}

// The one entry point.
//
//   profile  -- what the business said a good customer looks like
//   answers  -- what this lead said about itself
//   activity -- what the transcript shows, regardless of what was said
//
// Returns every component separately, because a score somebody cannot take apart
// is a score they cannot argue with, and the person whose commission depends on
// the order of this list is entitled to argue with it.
function scoreLead({ profile = {}, answers = {}, activity = {} } = {}) {
  const declared = declaredCriteria(profile);
  const weights = { ...DEFAULT_WEIGHTS, ...(profile.weights || {}) };

  const perCriterion = [];
  for (const criterion of declared) {
    let value = null;
    if (criterion === "industry") value = scoreMembership(answers.industry, textList(profile.industries));
    if (criterion === "region") value = scoreMembership(answers.region, textList(profile.regions));
    if (criterion === "teamSize") value = scoreRange(answers.teamSize, profile.teamSizeMin, profile.teamSizeMax);
    if (criterion === "budgetCents") {
      value = scoreRange(answers.budgetCents, profile.budgetMinCents, profile.budgetMaxCents);
    }
    if (criterion === "timelineDays") value = scoreUrgency(answers.timelineDays, profile.timelineDays);
    perCriterion.push({ criterion, score: value, answered: value !== null });
  }

  // Timeline is the urgency reading; the rest are the fit reading. Splitting
  // them here rather than at the call site keeps the two from being summed twice.
  const fitParts = perCriterion.filter((part) => part.criterion !== "timelineDays" && part.answered);
  const fit = fitParts.length
    ? Math.round(fitParts.reduce((sum, part) => sum + part.score, 0) / fitParts.length)
    : null;

  const urgencyPart = perCriterion.find((part) => part.criterion === "timelineDays");
  const urgency = urgencyPart && urgencyPart.answered ? urgencyPart.score : null;

  const engagement = scoreEngagement(activity);
  const risk = scoreRisk(profile, answers, activity);

  const answeredCount = perCriterion.filter((part) => part.answered).length;
  const confidence = declared.length ? answeredCount / declared.length : 0;

  const { score, used } = composite({ fit, urgency, engagement, risk: risk.score }, weights);
  const band = bandFor(score);

  const ignored = CRITERIA.filter(
    (criterion) => !declared.includes(criterion) && finiteNumber(answers[criterion]) !== null
  );

  return {
    fit,
    urgency,
    engagement,
    risk: risk.score,
    riskFlags: risk.flags,
    score,
    band,
    // True when the band is standing on less than half the profile. The page
    // must say so next to the band, not instead of it.
    provisional: score !== null && confidence < PROVISIONAL_BELOW,
    confidence: Number(confidence.toFixed(2)),
    declared,
    answered: answeredCount,
    perCriterion,
    // Criteria the lead volunteered that the profile does not score on. Not a
    // fault, but worth showing: it is usually the profile that is out of date.
    ignored,
    componentsUsed: used,
    weights
  };
}

module.exports = {
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
  DEFAULT_WEIGHTS,
  PROVISIONAL_BELOW
};
