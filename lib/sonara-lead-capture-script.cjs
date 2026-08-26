"use strict";

// What the chat widget asks, and why it is not written down anywhere.
//
// The questions are **derived from the ideal customer profile**, never listed
// separately. That is the whole design: a widget with its own question list and
// a scorer with its own criteria list are two lists that agree on the day they
// are written and never again. Somebody adds "what industry are you in" to the
// widget, nobody adds industry to the scorer, and the business spends a quarter
// answering a question that changes no number. Or the reverse -- a criterion is
// added to the profile, nothing asks about it, and every lead scores as
// unanswered on it for ever while the page reports a confidence of 60%.
//
// So `questionsFor` reads the profile and produces exactly the questions the
// scorer has something to do with. tests/the-widget-asks-what-the-score-needs
// asserts the two sets are equal in both directions, which is the only form of
// this guarantee that cannot rot.
//
// ## It is a script, not a model
//
// Nothing here calls a provider. A model in this position would be a cost per
// conversation and a per-message safety question -- somebody's chat widget
// saying something the business did not authorise -- and this product has
// decided neither of those on the customer's behalf. The widget follows the
// profile's own questions in order, and the page says so rather than implying a
// conversation is happening. A scripted widget that admits it is scripted is
// worth more than one that pretends and is caught.
//
// ## Contact is asked last, deliberately
//
// A form that demands an email before it says anything useful is the wall this
// product spent a sprint removing from its calculators. The qualifying questions
// come first, so a visitor who leaves halfway has still told the business
// something, and the transcript is worth reading even with no name on it.

const { CRITERIA } = require("./sonara-lead-scoring.cjs");

const OTHER_VALUE = "__other__";
const CONTACT_KEY = "contact";

// Horizons somebody would actually pick, mapped to the day counts the scorer
// compares against the profile's own timeline.
const TIMELINE_CHOICES = Object.freeze([
  { label: "This month", days: 30 },
  { label: "This quarter", days: 90 },
  { label: "In six months", days: 180 },
  { label: "Just looking", days: 365 }
]);

function cleanText(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text === "" ? null : text;
}

function textList(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  for (const entry of value) {
    const text = cleanText(entry);
    if (text && !seen.has(text.toLowerCase())) {
      seen.add(text.toLowerCase());
      out.push(text);
    }
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

function isEmailLike(value) {
  const text = cleanText(value);
  if (!text) return false;
  return text.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
}

// A phone number is whatever somebody's country says it is, so this checks only
// that there are enough digits to be one. Rejecting valid numbers is worse than
// accepting a wrong one: the business can ring a wrong number and find out, but
// it cannot ring a number the widget refused to take.
function isPhoneLike(value) {
  const text = cleanText(value);
  if (!text) return false;
  const digits = text.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

// Money as typed by a person: "1,200", "$1,200", "1200.50". Integer cents out,
// because a float near a total is how a price drifts by a penny per render.
function parseMoneyToCents(value) {
  const text = cleanText(value);
  if (text === null) return null;
  const stripped = text.replace(/[^0-9.]/g, "");
  if (stripped === "" || stripped.split(".").length > 2) return null;
  const amount = Number(stripped);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}

// The questions this profile justifies asking, in the order a person would ask
// them: what you do, where you are, how big, how soon, what you can spend, and
// then who you are.
function questionsFor(profile = {}) {
  const questions = [];

  const industries = textList(profile.industries);
  if (industries.length) {
    questions.push({
      key: "industry",
      prompt: "What kind of work do you do?",
      kind: "choice",
      options: industries.map((label) => ({ value: label, label })),
      allowOther: true,
      otherPrompt: "Tell me in your own words"
    });
  }

  const regions = textList(profile.regions);
  if (regions.length) {
    questions.push({
      key: "region",
      prompt: "Where are you based?",
      kind: "choice",
      options: regions.map((label) => ({ value: label, label })),
      allowOther: true,
      otherPrompt: "Somewhere else -- where?"
    });
  }

  if (finiteNumber(profile.teamSizeMin) !== null || finiteNumber(profile.teamSizeMax) !== null) {
    questions.push({
      key: "teamSize",
      prompt: "How many people are on the team?",
      kind: "number",
      unit: "people"
    });
  }

  if (finiteNumber(profile.timelineDays) !== null) {
    questions.push({
      key: "timelineDays",
      prompt: "When are you hoping to have this sorted?",
      kind: "choice",
      options: TIMELINE_CHOICES.map((choice) => ({ value: String(choice.days), label: choice.label })),
      allowOther: false
    });
  }

  if (finiteNumber(profile.budgetMinCents) !== null || finiteNumber(profile.budgetMaxCents) !== null) {
    questions.push({
      key: "budgetCents",
      prompt: "Roughly what budget are you working to?",
      kind: "money"
    });
  }

  // Always asked, and always last. Without it there is no lead, only a
  // transcript -- which is still worth keeping, and is kept.
  questions.push({
    key: CONTACT_KEY,
    prompt: "Who should we get back to, and how?",
    kind: "contact"
  });

  return questions;
}

// Turn what somebody typed or clicked into the value the scorer reads, or say
// why it cannot be used. Never coerces: Number("") is 0 and an empty budget must
// not become a budget of nothing.
function recordAnswer(profile = {}, key, raw) {
  const question = questionsFor(profile).find((entry) => entry.key === key);
  if (!question) return { ok: false, code: "unknown_question", message: "This profile does not ask that." };

  if (question.kind === "choice") {
    const text = cleanText(typeof raw === "object" && raw !== null ? raw.value : raw);
    if (text === null) return { ok: false, code: "blank", message: "Pick one, or say a bit more." };
    if (text === OTHER_VALUE) {
      const other = cleanText(typeof raw === "object" && raw !== null ? raw.other : null);
      if (!question.allowOther) {
        return { ok: false, code: "other_not_allowed", message: "Pick one of the options." };
      }
      if (other === null) return { ok: false, code: "blank", message: "Tell me in your own words." };
      // Kept as typed. It will not match the profile and will score as a miss,
      // which is the truth: they answered, and the answer is not what we sell to.
      return { ok: true, value: other, matchedOption: false };
    }
    if (question.key === "timelineDays") {
      const days = finiteNumber(text);
      if (days === null || days <= 0) return { ok: false, code: "not_a_choice", message: "Pick one of the options." };
      return { ok: true, value: days, matchedOption: true };
    }
    const matched = question.options.find((option) => option.value.toLowerCase() === text.toLowerCase());
    return { ok: true, value: matched ? matched.value : text, matchedOption: Boolean(matched) };
  }

  if (question.kind === "number") {
    const number = finiteNumber(raw);
    if (number === null) return { ok: false, code: "not_a_number", message: "A number, roughly, is fine." };
    if (number < 0) return { ok: false, code: "negative", message: "That cannot be less than nothing." };
    return { ok: true, value: Math.round(number) };
  }

  if (question.kind === "money") {
    const cents = parseMoneyToCents(raw);
    if (cents === null) return { ok: false, code: "not_money", message: "A rough figure is fine." };
    return { ok: true, value: cents };
  }

  if (question.kind === "contact") {
    const source = typeof raw === "object" && raw !== null ? raw : {};
    const name = cleanText(source.name);
    const email = cleanText(source.email);
    const phone = cleanText(source.phone);

    if (email !== null && !isEmailLike(email)) {
      return { ok: false, code: "bad_email", message: "That email address does not look right." };
    }
    if (phone !== null && !isPhoneLike(phone)) {
      return { ok: false, code: "bad_phone", message: "That phone number does not look right." };
    }
    if (email === null && phone === null) {
      return { ok: false, code: "no_way_back", message: "An email address or a phone number, whichever suits." };
    }
    return { ok: true, value: { name, email, phone } };
  }

  return { ok: false, code: "unknown_kind", message: "This profile does not ask that." };
}

// The next thing to say. Returns the question, or done with the reason it is
// done -- which is not always "they answered everything".
function nextStep(profile = {}, answers = {}) {
  const questions = questionsFor(profile);
  for (const question of questions) {
    const answered = question.key === CONTACT_KEY
      ? Boolean(answers[CONTACT_KEY] && (answers[CONTACT_KEY].email || answers[CONTACT_KEY].phone))
      : answers[question.key] !== undefined && answers[question.key] !== null;
    if (!answered) return { done: false, question, remaining: questions.length - questions.indexOf(question) };
  }
  return { done: true, remaining: 0 };
}

// What the transcript shows, regardless of what anybody said in it. The scorer's
// engagement reading is computed from this rather than from a counter the widget
// increments, because a counter can be wrong and a transcript cannot.
function transcriptActivity(profile = {}, messages = [], answers = {}) {
  const list = Array.isArray(messages) ? messages : [];
  const questions = questionsFor(profile);
  const scoring = questions.filter((question) => question.key !== CONTACT_KEY);

  const answered = scoring.filter(
    (question) => answers[question.key] !== undefined && answers[question.key] !== null
  ).length;

  const asked = list.filter((message) => message && message.role === "assistant" && message.questionKey).length;
  const visitorMessages = list.filter((message) => message && message.role === "visitor").length;

  const contact = answers[CONTACT_KEY];
  const gaveContact = Boolean(contact && (cleanText(contact.email) || cleanText(contact.phone)));

  return {
    // Asked is what the transcript records, not what the profile could ask. A
    // visitor who left after two questions was asked two.
    questionsAsked: asked || scoring.length,
    questionsAnswered: answered,
    visitorMessages,
    gaveContact
  };
}

// The answers in the shape the scorer wants: contact lifted out, everything else
// passed through under its criterion name.
function scorableAnswers(answers = {}) {
  const out = {};
  for (const criterion of CRITERIA) {
    if (answers[criterion] !== undefined && answers[criterion] !== null) out[criterion] = answers[criterion];
  }
  const contact = answers[CONTACT_KEY];
  if (contact && cleanText(contact.name)) out.company = cleanText(contact.name);
  if (answers.notes) out.notes = answers.notes;
  return out;
}

// Every question this script can ask that the scorer scores. Used by the test
// that holds the two in step; exported rather than recomputed there so the test
// cannot pass against its own copy of the list.
function scoringQuestionKeys(profile = {}) {
  return questionsFor(profile)
    .filter((question) => question.key !== CONTACT_KEY)
    .map((question) => question.key);
}

module.exports = {
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
};
