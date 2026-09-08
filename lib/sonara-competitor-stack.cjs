"use strict";

// What the alternatives cost, in one place, with the date they were read.
//
// `CLAUDE.md` is explicit about why this matters:
//
//   docs/market/ and docs/pricing/ -- what competing stacks cost and what we
//   actually replace, each figure dated and sourced. Read these before writing
//   a comparison into marketing copy; the numbers in them are checkable and the
//   ones in your memory are not.
//
// The pricing page did not read them. Our own price on that page is derived --
// `allThreeSentence` comes from STRIPE_PLANS, so it cannot drift -- while the
// competitor half was two hand-typed sentences in server.js. They said "$39 for
// the business side, $39 for the creator side ... around $87 a month ... from
// published prices in August 2026" for three days after the 5 September
// re-survey moved Jobber to $49, Podia to $49 and the stack to $107.
//
// That understated us. All three at $59 is 55% of the real stack; against $87 it
// reads as 68%, so the page was quietly making the weaker argument.
//
// The figures live here so the page renders from them, and
// tests/the-pricing-page-quotes-the-survey-it-cites.test.js checks these against
// the dated document they come from. Nothing can verify a competitor's price for
// us -- it lives on somebody else's site -- so what is enforced instead is that
// the page, this module and the survey document all say the same thing, and that
// the date is stated wherever the figure is.

// Read 5 September 2026 from the sources cited in the document below. Monthly
// billing, entry plans, which is the comparison hardest to argue with.
const COMPETITOR_STACK = Object.freeze({
  surveyedOn: "September 2026",
  surveyedOnIso: "2026-09-05",
  sourceDocument: "docs/pricing/2026-09-05-PRICING-STRATEGY.md",
  columns: Object.freeze([
    Object.freeze({ job: "business", product: "Jobber", plan: "Core", monthlyUsd: 49 }),
    Object.freeze({ job: "creator", product: "Podia", plan: "Mover", monthlyUsd: 49 }),
    Object.freeze({ job: "marketing", product: "Brevo", plan: "Starter", monthlyUsd: 9 })
  ]),
  // The same set with marketing automation switched on -- Brevo Standard at $18
  // rather than Starter at $9. The document is careful about what this does NOT
  // include, and so is the page: "Whether the logo add-on is still required on
  // Standard was not confirmed and is not included."
  withAutomationMonthlyUsd: 116,
  // Podia Mover charges 5% on digital sales. On $2,000 a month that is another
  // $100 -- more than the subscription.
  creatorTransactionFeePercent: 5
});

function stackMonthlyUsd() {
  return COMPETITOR_STACK.columns.reduce((total, column) => total + column.monthlyUsd, 0);
}

function columnFor(job) {
  return COMPETITOR_STACK.columns.find((column) => column.job === job) || null;
}

// The sentence the pricing page shows beside our own price. Written here so the
// figures and the date cannot be separated: a price copied without a date is a
// price that is wrong later and looks right forever.
function whatItCostsElsewhereSentence() {
  const business = columnFor("business");
  const creator = columnFor("creator");
  const marketing = columnFor("marketing");
  return (
    `Buying these three jobs separately usually means about $${business.monthlyUsd} a month for the business side, ` +
    `$${creator.monthlyUsd} for the creator side, and $${marketing.monthlyUsd} for the marketing side — around ` +
    `$${stackMonthlyUsd()} a month on monthly billing, from published prices in ${COMPETITOR_STACK.surveyedOn}. ` +
    `The creator tool at that price also takes ${COMPETITOR_STACK.creatorTransactionFeePercent}% of what you sell.`
  );
}

function whyCheaperSentence() {
  return (
    `We checked in ${COMPETITOR_STACK.surveyedOn} what the usual tools charge for these three jobs on monthly ` +
    `billing. Their entry plans came to about $${stackMonthlyUsd()} a month for the set, and nearer ` +
    `$${COMPETITOR_STACK.withAutomationMonthlyUsd} on the plan that turns marketing automation on.`
  );
}

module.exports = {
  COMPETITOR_STACK,
  stackMonthlyUsd,
  columnFor,
  whatItCostsElsewhereSentence,
  whyCheaperSentence
};
