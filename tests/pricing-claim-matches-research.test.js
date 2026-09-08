"use strict";

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
// The survey the page actually quotes, named by the module the page renders
// from. This read docs/market/2026-08-12-MARKET-AUDIT.md until 8 September 2026
// -- see the second note below.
const SURVEY = fs.readFileSync(path.join(root, COMPETITOR_STACK.sourceDocument), "utf8");
const SERVER = fs.readFileSync(path.join(root, "server.js"), "utf8");
const RESTRUCTURE = fs.readFileSync(path.join(root, "docs", "pricing", "2026-08-11-PRICING-RESTRUCTURE.md"), "utf8");

// The pricing page told customers the competing stack costs $77 a month for
// two weeks. It does not, and never did on the billing period a new customer
// takes -- $77 was Jobber's annual price added to Podia's monthly one. The
// figure was researched once, written into three places, and then only the
// research was ever revisited.
//
// A number a customer reads has to come from somewhere that can be checked.
// This ties the claim on screen to the document that establishes it.
//
// It did that against the WRONG document for three days. It read the 12 August
// audit, and on 5 September the market was re-surveyed into
// docs/pricing/2026-09-05-PRICING-STRATEGY.md -- Jobber $39 to $49, Podia $39 to
// $49, the stack $87 to $107. Nothing moved this check's authority, so it went
// on requiring the page to say $87, and the page obligingly did. The check was
// not broken and never went quiet; it was pinned to a survey that had been
// superseded, which is the exemption-whose-reason-expired shape in
// `.claude/skills/checks-that-cannot-lie` wearing a different coat.
//
// Both halves are now read from lib/sonara-competitor-stack.cjs: the figures the
// page renders, and the name of the survey they came from. One answer to "which
// survey is current", in the module the page itself uses.
describe("the comparison a customer reads matches the research behind it", () => {
  const headline = String(stackMonthlyUsd());

  it("can read the researched figure from the survey it names", () => {
    assert.ok(SURVEY.length > 2000, `${COMPETITOR_STACK.sourceDocument} is too short to be the survey; this check is inert`);
    assert.ok(Number(headline) > 50, `a stack figure of $${headline} is implausible; the module is wrong`);
    assert.match(
      SURVEY,
      new RegExp(`\\*\\*The stack\\*\\*[^\\n]*\\*\\*\\$${headline}\\*\\*`),
      `${COMPETITOR_STACK.sourceDocument} does not establish $${headline}`
    );
  });

  it("quotes that figure to customers, and no other", () => {
    // Read from the rendered sentences rather than scraped out of server.js.
    // The figures left server.js on 8 September -- that is the fix -- so a regex
    // over that file now finds nothing and would pass by measuring nothing.
    const sentences = [whatItCostsElsewhereSentence(), whyCheaperSentence()];
    // Only the sentence that totals the stack. The original comment here warned
    // that matching any "$N a month" catches "$49 a month for the business side"
    // -- a per-product figure in the same sentence, which is not the claim. I
    // widened it while rewriting this and the test caught it immediately, which
    // is the whole argument for leaving the narrow pattern alone.
    const claims = sentences.flatMap((sentence) =>
      [
        ...sentence.matchAll(/(?:around|about) \$(\d+) a month on monthly billing/g),
        ...sentence.matchAll(/(?:around|about) \$(\d+) a month for the set/g)
      ].map((match) => match[1])
    );
    assert.ok(claims.length > 0, "no stack comparison found in the rendered sentences; this check has gone blind");
    for (const claim of claims) {
      assert.equal(claim, headline, `a page claims $${claim} while ${COMPETITOR_STACK.sourceDocument} establishes $${headline}`);
    }
  });

  it("says which billing period the comparison is on", () => {
    // The whole original error was comparing an annual price to a monthly one.
    // A figure without its billing period is the same mistake waiting.
    const sentences = [whatItCostsElsewhereSentence(), whyCheaperSentence()];
    assert.ok(
      sentences.some((sentence) => /monthly billing/i.test(sentence)),
      "no comparison sentence names the billing period; that is the error this check exists for"
    );
  });

  it("does not let a superseded figure stand as current", () => {
    // This required the 11 August restructure document to mention the current
    // stack total. That was right while the August audit was the survey and
    // wrong the moment a later one existed: 2026-08-11-PRICING-RESTRUCTURE.md is
    // a dated record of an argument made in August, and the September strategy
    // says so itself -- "updates the argument in
    // 2026-08-11-PRICING-RESTRUCTURE.md. The recommendation in that second
    // document still stands; the numbers underneath it moved in our favour."
    // Demanding a historical document carry a later figure would mean rewriting
    // the record every time the market moves, which is how a dated document
    // stops being one.
    //
    // What still matters, and is what this case was really for, is that a
    // corrected figure is not left standing as current anywhere.
    assert.doesNotMatch(
      RESTRUCTURE,
      /costs \$77 a month/,
      "the superseded $77 claim is still stated as current"
    );
  });

  it("does not leave the old figure anywhere a customer can see it", () => {
    assert.doesNotMatch(SERVER, /\$77/, "the corrected figure did not replace every customer-facing use");
  });

  it("carries sources, so the figure can be re-checked rather than trusted", () => {
    // Counted as URLs rather than bullets. The August audit listed one link per
    // line; the September survey groups several under each product, so a
    // per-bullet count read 3 where the document actually cites nine. What the
    // claim needs is checkable references, not a particular layout.
    const sources = (SURVEY.match(/https?:\/\/[^ ,>)\n]+/g) || []).length;
    assert.ok(sources >= 4, `${COMPETITOR_STACK.sourceDocument} cites ${sources} sources; a pricing claim needs more than a memory`);
  });
});
