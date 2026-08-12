"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const AUDIT = fs.readFileSync(path.join(root, "docs", "market", "2026-08-12-MARKET-AUDIT.md"), "utf8");
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
describe("the comparison a customer reads matches the research behind it", () => {
  // The headline figure, read out of the audit rather than restated here.
  const headline = AUDIT.match(/\*\*Stack\*\* \| \| \*\*\$(\d+)\*\*/)?.[1];

  it("can read the researched figure from the audit", () => {
    assert.ok(headline, "the audit's stack row could not be parsed; this check is inert");
    assert.ok(Number(headline) > 50, `a stack figure of $${headline} is implausible; the parse is wrong`);
  });

  it("quotes that figure on the customer-facing pages, and no other", () => {
    // Only the sentence that totals the stack. An earlier version matched any
    // "$N a month" and caught "$39 a month for the business side" -- a
    // per-product figure in the same sentence, which is not the claim.
    const claims = [...SERVER.matchAll(/(?:around|about) \$(\d+) a month on monthly billing|(?:around|about) \$(\d+) a month for the set/g)]
      .map((match) => match[1] || match[2]);
    assert.ok(claims.length > 0, "no stack comparison found in server.js; this check has gone blind");
    for (const claim of claims) {
      assert.equal(claim, headline, `a page claims $${claim} while the audit establishes $${headline}`);
    }
  });

  it("says which billing period the comparison is on", () => {
    // The whole error was comparing an annual price to a monthly one. A figure
    // without its billing period is the same mistake waiting to be repeated.
    const comparisons = SERVER.match(/[^.]*\$\d+ a month[^.]*\./g) || [];
    assert.ok(comparisons.length > 0, "no comparison sentence found");
    assert.ok(
      comparisons.some((sentence) => /monthly billing/i.test(sentence)),
      "no comparison sentence names the billing period; that is the error this check exists for"
    );
  });

  it("keeps the recommendation document on the same figure", () => {
    assert.ok(
      RESTRUCTURE.includes(`$${headline}`),
      `the restructure document does not mention $${headline}, so it is arguing against a different stack`
    );
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
    const sources = (AUDIT.match(/^- \[.+\]\(https?:\/\//gm) || []).length;
    assert.ok(sources >= 4, `the audit cites ${sources} sources; a pricing claim needs more than a memory`);
  });
});
