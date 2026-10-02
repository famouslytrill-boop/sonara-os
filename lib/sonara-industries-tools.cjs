// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Three tools that belong to the parent company rather than to a studio.
//
// ## Why the parent needs its own, and why only three
//
// Every one of the forty tools before these sat under /business-builder/,
// /creator-studio/ or /growth-studio/, so SONARA Industries -- the company that
// owns all three -- had no public surface of its own. A visitor who had not yet
// decided which studio they needed had nothing to open.
//
// These three answer questions no single studio can answer, which is the test
// each one had to pass to be here. A tool that would be just as correct inside
// one studio belongs in that studio, not at the parent.
//
//   * /tools/which-studio      -- which of the three fits the work in front of
//                                 you. A studio cannot answer this without
//                                 recommending itself.
//   * /tools/retyping-cost     -- what copying the same record between separate
//                                 products costs you in a year. This is the
//                                 parent's own claim ("one record, not three",
//                                 on the public home page) put to arithmetic.
//   * /tools/subscription-count -- how many products hold your customer list,
//                                 and what the stack totals. The duplication is
//                                 a fact about the whole stack.
//
// ## How each differs from the nearest studio tool
//
// Stated because two of them look close to one, and "it is different" is the
// kind of claim this repository expects to be checkable:
//
//   * /business-builder/tools/software-spend prices seats on ONE product --
//     seats paid for against seats used. /tools/subscription-count prices the
//     NUMBER OF PRODUCTS and how many of them hold the same customer list. The
//     first is a seat-utilisation question, the second a duplication question,
//     and tests/the-parent-company-has-its-own-front-door.test.js asserts the
//     two take different inputs.
//   * /creator-studio/tools/rate-card builds a day rate for creative work from
//     the income a creator needs. Nothing here does that; /tools/retyping-cost
//     takes an hourly rate as an input rather than producing one.
//
// ## The two rules from the studio tools, unchanged
//
// A number that cannot be read is named rather than turned into NaN, and a case
// with no answer says so rather than returning zero. Both are inherited from
// lib/sonara-planner-tools.cjs by using its reader.
//
// ## No price of ours appears in any of them
//
// Deliberately. CLAUDE.md records three stale comparisons this repository has
// already shipped, and a calculator that bakes in what SONARA costs -- or what a
// competitor costs -- is a figure that goes out of date inside the product,
// where nobody is looking at it. Every number these produce is arithmetic on
// what the visitor typed. Where a price is the answer, they link to /pricing,
// which is generated from the plans.

const { numberFrom } = require("./sonara-planner-tools.cjs");
// The count, never written here. The first draft of this file said "Twelve
// tools across the three studios are free" in a sentence a visitor reads, and
// scripts/verify-free-tool-count.mjs refused it on the same afternoon it was
// written -- while the free set was fifteen. That is the check doing its job on
// its author.
const { freeToolSentence } = require("./sonara-tool-access.cjs");

function money(value) {
  return `$${value.toFixed(2)}`;
}

function whole(value) {
  return String(Math.round(value));
}

function unusable(labels) {
  return {
    couldNotCalculate: `We could not read ${labels.join(" or ")} as a number, so nothing below would be trustworthy.`,
    whatToDo: "Enter digits only for those boxes and run it again.",
    nothingWasGuessed: "No figure has been estimated in place of what was typed."
  };
}

// `values[key] = parsed` is a dynamic property write, and the one in the storefront
// was a real injection -- CodeQL raised it on 2 October 2026. This one is not: `key`
// comes from `Object.entries(spec)`, and every `spec` passed in is a literal written
// in this file a few lines below each call. The request supplies the VALUE, which is
// parsed as a number, never the key. Stated because the two look identical and only
// one of them is a problem.
function readNumbers(body, spec) {
  const values = {};
  const bad = [];
  for (const [key, label] of Object.entries(spec)) {
    const parsed = numberFrom(body[key]);
    if (parsed === null || parsed < 0) bad.push(label);
    else values[key] = parsed;
  }
  return bad.length ? { ok: false, output: unusable(bad) } : { ok: true, values };
}

// ---------------------------------------------------------------------------
// Which studio
// ---------------------------------------------------------------------------

// The three studios, with what each is for in the words AGENTS.md fixes. Taken
// from the "Public Product Positioning" section rather than reworded, so this
// cannot drift from the positioning the rest of the product is held to.
const STUDIOS = Object.freeze([
  Object.freeze({
    key: "business_builder",
    name: "Business Builder",
    path: "/business-builder",
    toolsPath: "/business-builder/tools",
    forWhat: "create, launch, run, and manage a business with guided systems, payments, bookings, records, and operational intelligence"
  }),
  Object.freeze({
    key: "creator_studio",
    name: "Creator Studio",
    path: "/creator-studio",
    toolsPath: "/creator-studio/tools",
    forWhat: "organize, protect, publish, monetize, and grow creative work, digital products, media, and creator operations"
  }),
  Object.freeze({
    key: "growth_studio",
    name: "Growth Studio",
    path: "/growth-studio",
    toolsPath: "/growth-studio/tools",
    forWhat: "attract customers, leads, fans, referrals, reviews, and revenue through campaigns, follow-up, offers, and growth systems"
  })
]);

// Six yes/no questions, two scoring to each studio. Two rather than one so a
// single misread question cannot decide the answer on its own.
const STUDIO_QUESTIONS = Object.freeze([
  Object.freeze({ name: "takingPayments", studio: "business_builder", label: "You need to take money from customers, or you already do" }),
  Object.freeze({ name: "runningOperations", studio: "business_builder", label: "You have bookings, stock, staff or jobs to keep straight" }),
  Object.freeze({ name: "makingWork", studio: "creator_studio", label: "You make something -- music, video, writing, images, design" }),
  Object.freeze({ name: "rightsMatter", studio: "creator_studio", label: "Who owns what, and who gets paid what share, needs writing down" }),
  Object.freeze({ name: "needCustomers", studio: "growth_studio", label: "Not enough people know you exist yet" }),
  Object.freeze({ name: "followingUp", studio: "growth_studio", label: "Enquiries arrive and some of them go cold before you answer" })
]);

const YES = new Set(["yes", "y", "true", "on", "1"]);

function saidYes(value) {
  return YES.has(String(value == null ? "" : value).trim().toLowerCase());
}

/**
 * Which studio, from six answers.
 *
 * Three states, not two. A visitor who answered nothing gets told that nothing
 * was answered -- not Business Builder because it happens to be first. That is
 * the whole reason this returns a `tie` and an `answeredNothing` case rather
 * than always naming one studio: a recommendation made from no information is a
 * recommendation this product cannot stand behind.
 */
function whichStudio(body) {
  const scores = new Map(STUDIOS.map((studio) => [studio.key, 0]));
  let answered = 0;
  for (const question of STUDIO_QUESTIONS) {
    if (saidYes(body[question.name])) {
      scores.set(question.studio, scores.get(question.studio) + 1);
      answered += 1;
    }
  }

  const byStudio = STUDIOS.map((studio) => ({ studio, score: scores.get(studio.key) }));

  if (answered === 0) {
    return {
      whichOne: "Nothing was ticked, so there is nothing here to go on.",
      whyNotAGuess: "We are not naming a studio on no answers. Picking the first one and calling it a recommendation would be a guess dressed up as advice.",
      whatToDo: "Tick whichever lines are true -- any number of them -- and run it again.",
      everythingIsFree: `${freeToolSentence()} So you can also just open one and see.`,
      allThree: STUDIOS.map((studio) => `${studio.name}: ${studio.forWhat}.`).join(" ")
    };
  }

  const top = Math.max(...byStudio.map((entry) => entry.score));
  const leaders = byStudio.filter((entry) => entry.score === top);

  if (leaders.length > 1) {
    return {
      whichOne: `${leaders.map((entry) => entry.studio.name).join(" and ")} score the same on what you ticked.`,
      whyTwo: "That is a real answer rather than a failure to decide: what you described genuinely spans them, and one account covers all three.",
      startWith: `Start with ${leaders[0].studio.name} -- ${leaders[0].studio.forWhat} -- and open the other when you need it.`,
      whatEachIsFor: leaders.map((entry) => `${entry.studio.name}: ${entry.studio.forWhat}.`).join(" "),
      freeToOpen: `Each has free tools: ${leaders.map((entry) => entry.studio.toolsPath).join(" and ")}.`
    };
  }

  const winner = leaders[0].studio;
  const others = byStudio.filter((entry) => entry.studio.key !== winner.key && entry.score > 0);
  return {
    whichOne: `${winner.name}.`,
    whatItIsFor: `${winner.name} is to ${winner.forWhat}.`,
    whyThisOne: `You ticked ${leaders[0].score} of the ${STUDIO_QUESTIONS.filter((question) => question.studio === winner.key).length} lines that point at it.`,
    alsoRelevant: others.length
      ? `${others.map((entry) => entry.studio.name).join(" and ")} also scored, so some of what you described sits there. One account covers all three.`
      : "Nothing you ticked points at the other two yet. They are there on the same account when it does.",
    startHere: `Open ${winner.toolsPath} and use the free tools first. No account and no card.`,
    nextAction: `Read ${winner.path} before paying for anything, and check /pricing for what a plan covers.`
  };
}

// ---------------------------------------------------------------------------
// Re-typing cost
// ---------------------------------------------------------------------------

const MINUTES_PER_HOUR = 60;
const WEEKS_PER_YEAR = 52;

/**
 * What copying the same record between separate products costs in a year.
 *
 * The one case worth guarding: somebody who copies nothing. Returning "$0.00 a
 * year" there is arithmetically right and useless, so it says what it means --
 * nothing is being re-typed, so there is nothing here to save.
 */
function retypingCost(body) {
  const read = readNumbers(body, {
    copiesPerWeek: "times a week you copy something across",
    minutesPerCopy: "minutes one copy takes",
    hourlyRate: "what an hour of your time is worth",
    peopleDoingIt: "how many people do this"
  });
  if (!read.ok) return read.output;
  const { copiesPerWeek, minutesPerCopy, hourlyRate, peopleDoingIt } = read.values;

  if (copiesPerWeek === 0 || minutesPerCopy === 0 || peopleDoingIt === 0) {
    return {
      yearlyCost: "Nothing is being re-typed, on these numbers.",
      whatThatMeans: "There is nothing here for a connected system to save you. That is a good position to be in, and worth re-checking when you add the next product.",
      nothingWasGuessed: "No figure has been estimated in place of what was typed."
    };
  }

  const minutesPerWeek = copiesPerWeek * minutesPerCopy * peopleDoingIt;
  const hoursPerWeek = minutesPerWeek / MINUTES_PER_HOUR;
  const hoursPerYear = hoursPerWeek * WEEKS_PER_YEAR;
  const costPerYear = hoursPerYear * hourlyRate;
  const workingDays = hoursPerYear / 8;

  return {
    hoursPerWeek: `${hoursPerWeek.toFixed(1)} hours a week go into copying the same thing from one place to another.`,
    hoursPerYear: `${whole(hoursPerYear)} hours a year, which is ${workingDays.toFixed(1)} working days.`,
    yearlyCost: `${money(costPerYear)} a year at ${money(hourlyRate)} an hour.`,
    // The second cost, and the one people leave out. Not a figure we invent a
    // rate for: it is stated as a consequence, with the arithmetic left to the
    // reader, because an error rate we made up would be exactly the kind of
    // number this file refuses to carry.
    theOtherCost: "Every copy is also a chance for the two versions to differ. That cost does not appear above, because we are not going to invent an error rate for you -- but an invoice built from the wrong figure costs more than the minutes did.",
    whatToCompare: `Compare ${money(costPerYear)} a year against what a single connected system costs. /pricing has ours.`,
    nextAction: "Count one week honestly before trusting this. Most people guess low on how often they copy a customer detail across."
  };
}

// ---------------------------------------------------------------------------
// Subscription count
// ---------------------------------------------------------------------------

/**
 * How many products hold your customer list, and what the stack totals.
 *
 * `productsHoldingCustomers` is the input that makes this a different question
 * from seat utilisation: a stack of eight products where six hold the same
 * customer list has five copies of that list to keep in step.
 *
 * Guarded case: more products holding customers than products. That is not a
 * number to compute from -- it is a typo, and a tool that quietly took the
 * minimum would report a confident answer to a question nobody asked.
 */
function subscriptionCount(body) {
  const read = readNumbers(body, {
    productCount: "how many products you pay for",
    monthlyTotal: "what they total a month",
    productsHoldingCustomers: "how many hold your customer list"
  });
  if (!read.ok) return read.output;
  const { productCount, monthlyTotal, productsHoldingCustomers } = read.values;

  if (productsHoldingCustomers > productCount) {
    return {
      couldNotCalculate: `You have said ${whole(productsHoldingCustomers)} products hold your customer list out of ${whole(productCount)} you pay for, and that cannot both be true.`,
      whatToDo: "Check the two numbers and run it again.",
      nothingWasGuessed: "Nothing has been computed from these figures. We have not quietly taken the smaller number."
    };
  }

  if (productCount === 0) {
    return {
      yearlyTotal: "You are paying for nothing, on these numbers.",
      whatThatMeans: "Nothing to consolidate and nothing to total. Worth running again at the point you are paying for three things.",
      nothingWasGuessed: "No figure has been estimated in place of what was typed."
    };
  }

  const yearlyTotal = monthlyTotal * 12;
  const averagePerProduct = monthlyTotal / productCount;
  const duplicateCopies = Math.max(0, productsHoldingCustomers - 1);

  return {
    yearlyTotal: `${money(yearlyTotal)} a year across ${whole(productCount)} products.`,
    averagePerProduct: `${money(averagePerProduct)} a month each, on average.`,
    duplicateCustomerLists: duplicateCopies === 0
      ? "One place holds your customer list, or none does. Nothing is being kept in step by hand."
      : `${whole(duplicateCopies)} duplicate ${duplicateCopies === 1 ? "copy" : "copies"} of your customer list. Every change has to reach ${whole(productsHoldingCustomers)} places to be true everywhere.`,
    whyThatMatters: duplicateCopies === 0
      ? "Keep it that way as you add products. The cost of a split customer list is paid later, by the person who trusts the wrong version of it."
      : "This is the cost that is not on any invoice: a phone number corrected in one place and stale in the others, and no way to tell which is right.",
    whatToCompare: `Compare ${money(yearlyTotal)} a year against one plan covering the same ground. /pricing has ours, and it says what it does not cover.`,
    nextAction: "List the products by name before trusting the count. The ones people forget are the annual ones."
  };
}

// ---------------------------------------------------------------------------
// The records
// ---------------------------------------------------------------------------

// `productKey` is null on every one of these, and that is load-bearing rather
// than an omission. There is no plan that covers "the parent company", so there
// is no entitlement to check -- which means if one of these ever left the free
// set, routes/sonara-service-lifecycle-routes.cjs would answer `unknown_product`
// ("That is a fault on our side"), correctly, to a customer. So it must not
// happen quietly: tests/the-parent-company-has-its-own-front-door.test.js
// asserts every path here is in FREE_TOOL_PATHS, and that is the check standing
// between that comment and a page nobody can open.
//
// `directoryPath` exists because the studio tools derive their directory from
// `slug` as `/${slug}/tools`, and these have no slug. Set rather than left to
// that default, which would produce `/undefined/tools`.
const INDUSTRIES_TOOLS = Object.freeze([
  Object.freeze({
    slug: null,
    productKey: null,
    directoryPath: "/tools",
    path: "/tools/which-studio",
    title: "Which Part Do You Need?",
    module: "which_studio_router",
    description: "Six questions, and a straight answer about which of the three studios fits the work in front of you -- including when it is two of them.",
    submitLabel: "Tell me which one",
    fields: STUDIO_QUESTIONS.map((question) => ({ name: question.name, label: question.label, type: "checkbox", value: "yes" })),
    // Nothing is required. A visitor who ticks nothing gets told nothing was
    // ticked, which is the honest answer and is asserted as one.
    requiredFields: [],
    build: whichStudio
  }),
  Object.freeze({
    slug: null,
    productKey: null,
    directoryPath: "/tools",
    path: "/tools/retyping-cost",
    title: "What Is Re-typing Costing You?",
    module: "retyping_cost_counter",
    description: "Count the hours a year that go into copying the same customer detail from one product into another, and what those hours are worth.",
    submitLabel: "Work out the cost",
    fields: [
      { name: "copiesPerWeek", label: "Times a week you copy something from one product into another", required: true },
      { name: "minutesPerCopy", label: "Minutes one copy takes", required: true },
      { name: "hourlyRate", label: "What an hour of that person's time is worth", required: true },
      { name: "peopleDoingIt", label: "How many people do this", required: true }
    ],
    requiredFields: ["copiesPerWeek", "minutesPerCopy", "hourlyRate", "peopleDoingIt"],
    build: retypingCost
  }),
  Object.freeze({
    slug: null,
    productKey: null,
    directoryPath: "/tools",
    path: "/tools/subscription-count",
    title: "How Many Products Hold Your Customer List?",
    module: "subscription_count_auditor",
    description: "Total what your stack costs a year, and count how many separate products are holding a copy of the same customer list.",
    submitLabel: "Count the stack",
    fields: [
      { name: "productCount", label: "How many products you pay for", required: true },
      { name: "monthlyTotal", label: "What they total a month, all together", required: true },
      { name: "productsHoldingCustomers", label: "How many of them hold your customer list", required: true }
    ],
    requiredFields: ["productCount", "monthlyTotal", "productsHoldingCustomers"],
    build: subscriptionCount
  })
]);

const INDUSTRIES_TOOLS_DIRECTORY = "/tools";

module.exports = {
  INDUSTRIES_TOOLS,
  INDUSTRIES_TOOLS_DIRECTORY,
  STUDIOS,
  STUDIO_QUESTIONS,
  saidYes,
  whichStudio,
  retypingCost,
  subscriptionCount
};
