"use strict";

// The pricing page said "$87 a month … from published prices in August 2026"
// for three days after the survey it cites moved to $107.
//
// Our own price on that page is derived: `allThreeSentence` comes from
// STRIPE_PLANS, and tests/a-price-in-prose-is-the-price-we-charge.test.js
// compares every price sentence in docs/ against what Stripe charges. The
// competitor half had neither. It was two hand-typed sentences in server.js,
// and nothing in the repository could tell they had gone stale.
//
// It went stale in the direction that costs us. All three at $59 is 55% of the
// real $107 stack; quoted against $87 it reads as 68%, so the page was making
// the weaker version of its own argument.
//
// CLAUDE.md names the rule this broke: "Read these before writing a comparison
// into marketing copy; the numbers in them are checkable and the ones in your
// memory are not."
//
// WHAT THIS CAN AND CANNOT CHECK. Nothing here can verify what Jobber charges --
// that lives on somebody else's site, and a check that pretended otherwise would
// be inventing a fact. What is enforced instead is that three things agree: the
// module the page renders from, the dated document it cites, and the page copy
// itself. And that the date travels with the figures, because a price copied
// without a date is a price that is wrong later and looks right forever.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  COMPETITOR_STACK,
  stackMonthlyUsd,
  whatItCostsElsewhereSentence,
  whyCheaperSentence
} = require("../lib/sonara-competitor-stack.cjs");

const root = path.join(__dirname, "..");
const survey = fs.readFileSync(path.join(root, COMPETITOR_STACK.sourceDocument), "utf8");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");

describe("the pricing page quotes the survey it cites", () => {
  it("reads a real survey document, not an empty one", () => {
    // Shape 1: a missing or emptied document would make every comparison below
    // pass by matching nothing.
    assert.ok(survey.length > 2000, `${COMPETITOR_STACK.sourceDocument} is only ${survey.length} characters; this check has gone blind`);
    assert.ok(COMPETITOR_STACK.columns.length >= 3, "the stack has fewer than three columns; it is not the set the page describes");
  });

  it("matches every column against the document it names", () => {
    // The document is the authority. Each figure must appear in it beside its
    // product, so the module cannot quietly hold a number the survey does not.
    for (const column of COMPETITOR_STACK.columns) {
      const pattern = new RegExp(`${column.product}[^\\n|]*\\|[^\\n|]*\\*\\*\\$${column.monthlyUsd}\\*\\*`);
      assert.match(
        survey,
        pattern,
        `${COMPETITOR_STACK.sourceDocument} does not show ${column.product} at $${column.monthlyUsd}. ` +
          "Either the survey was re-run and this module was not updated, or the module holds a figure nobody surveyed."
      );
    }
  });

  it("totals the stack rather than restating it", () => {
    const total = stackMonthlyUsd();
    assert.equal(
      total,
      COMPETITOR_STACK.columns.reduce((sum, column) => sum + column.monthlyUsd, 0),
      "the stack total is not the sum of its columns"
    );
    assert.match(
      survey,
      new RegExp(`\\*\\*The stack\\*\\*[^\\n]*\\*\\*\\$${total}\\*\\*`),
      `${COMPETITOR_STACK.sourceDocument} does not put the stack at $${total}`
    );
  });

  it("says when the figures were read, in the sentences themselves", () => {
    // The one thing that makes a competitor figure honest when it goes stale.
    for (const sentence of [whatItCostsElsewhereSentence(), whyCheaperSentence()]) {
      assert.ok(
        sentence.includes(COMPETITOR_STACK.surveyedOn),
        `a pricing sentence states figures without saying when they were read:\n  ${sentence}`
      );
      assert.ok(sentence.includes(`$${stackMonthlyUsd()}`), `a pricing sentence does not state the stack total:\n  ${sentence}`);
    }
  });

  it("renders the page from the module rather than a typed-in copy", () => {
    // The failure this whole file exists for. server.js must not carry the
    // figures as literals again.
    assert.match(server, /whatItCostsElsewhereSentence\(\)/, "the pricing page no longer renders the cost-elsewhere sentence from the module");
    assert.match(server, /whyCheaperSentence\(\)/, "the pricing page no longer renders the why-cheaper sentence from the module");
    assert.doesNotMatch(
      server,
      /published prices in August 2026/,
      "server.js has the August survey typed back into it"
    );
    assert.doesNotMatch(
      server,
      /around \$\d+ a month on monthly billing/,
      "server.js is stating a stack total as a literal again instead of rendering it"
    );
  });

  it("does not claim the logo add-on is included in the automation figure", () => {
    // The survey is careful here and the page must be too: "Whether the logo
    // add-on is still required on Standard was not confirmed and is not
    // included." The August copy asserted both at once -- "$105 once you remove
    // another company's logo from your emails and turn automation on" -- which
    // stated as settled something the survey had explicitly not settled.
    assert.match(
      survey,
      /was not confirmed and is not included/,
      "the survey no longer records the logo add-on as unconfirmed; re-read it before relaxing this"
    );
    assert.doesNotMatch(
      whyCheaperSentence(),
      /logo/i,
      "the automation figure is claiming the logo add-on again, which the survey says it does not include"
    );
  });
});
