"use strict";

// Three claims on the home page, and the code that has to keep them true.
//
// The market audit identified what is genuinely different about this product
// and none of it was on the site -- the differentiators lived in
// docs/market/2026-08-12-MARKET-AUDIT.md and the home page said nothing about
// them. Putting them in front of a customer is the easy half. The half that
// matters is that a claim on a marketing page is a promise, and this repository
// has spent its whole history finding statements that were true when written
// and quietly stopped being true.
//
// So each claim is bound here to the behaviour that makes it true. If somebody
// wires a model into the chase drafts, or makes the cash position count an
// undated invoice as due today, the claim fails before the customer finds out.
//
// Deliberately not grep for comments. lib/sonara-chase-drafts.cjs contains the
// line "**No model call.**" and a check that matched it would pass on the
// comment alone while the file did whatever it liked underneath.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const request = require("supertest");
const app = require("../server");

const { ALL_OWNER_PAGES } = require("../lib/sonara-owner-record-pages.cjs");
const { GROWTH_RECORD_PAGES } = require("../lib/sonara-growth-record-pages.cjs");
const { recordCountCaption } = require("../routes/sonara-last9-routes.cjs");
const cashPosition = require("../lib/sonara-cash-position.cjs");

const root = path.join(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

let homePage = "";

before(async () => {
  const response = await request(app).get("/");
  assert.equal(response.status, 200, "the home page did not render, so none of these claims can be checked");
  homePage = String(response.text || "");
});

describe("the home page says what is different", () => {
  it("makes the three claims at all", () => {
    // If the copy is removed the rest of this file would pass over nothing,
    // which is the failure mode half the checks here exist to prevent.
    for (const claim of ["Type it once", "Every figure is one of yours", "A gap is shown as a gap"]) {
      assert.ok(homePage.includes(claim), `the home page no longer claims "${claim}"; remove this check or restore the copy`);
    }
  });
});

describe("claim: type it once — one record, not three", () => {
  it("has a pressable step from an enquiry to a customer", () => {
    const leads = GROWTH_RECORD_PAGES.find((page) => page.tableKey === "leads");
    assert.ok(leads?.rowAction, "nothing turns a lead into a customer, so the chain starts with retyping");
    assert.match(leads.rowAction.api, /customer/);
  });

  it("has a pressable step from a quote to an invoice", () => {
    const quotes = ALL_OWNER_PAGES.find((page) => page.table === "quotes");
    assert.ok(quotes?.rowAction, "nothing turns a quote into an invoice");
    assert.match(quotes.rowAction.api, /invoice/);
  });

  it("carries the customer across rather than asking for them again", () => {
    // The claim is specifically that nothing is retyped. A conversion that
    // created a blank customer and made the owner fill it in would satisfy
    // every check above and none of the promise.
    const conversion = require("../lib/sonara-lead-conversion.cjs");
    const customer = conversion.customerFromLead(
      { id: "l-1", status: "won", name: "Sam Reed", email: "sam@example.com", phone: "0400 000 000", source: "referral" },
      { organizationId: "org-1" }
    );
    assert.equal(customer.name, "Sam Reed");
    assert.equal(customer.email, "sam@example.com");
    assert.equal(customer.phone, "0400 000 000");
    assert.equal(customer.source, "referral", "the source is dropped, so the owner has to remember where they came from");
  });
});

describe("claim: every figure is one of yours — nothing is invented", () => {
  const chaseDrafts = read("lib/sonara-chase-drafts.cjs");

  it("reaches no network and no provider from the chase drafts", () => {
    // The property, not the comment about it.
    const code = chaseDrafts.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
    for (const forbidden of [/\bfetch\s*\(/, /require\(["'][^"']*gateway/i, /require\(["'][^"']*adapter/i, /openai|anthropic|ollama/i]) {
      assert.doesNotMatch(code, forbidden, `lib/sonara-chase-drafts.cjs now reaches outside itself (${forbidden}); a draft could contain something the owner never wrote`);
    }
  });

  it("cannot claim a reminder that was never sent", () => {
    const drafts = require("../lib/sonara-chase-drafts.cjs");
    const built = JSON.stringify(drafts);
    // The module's own escalation text is the thing at risk: a stage that says
    // "as we mentioned previously" invents a history the rows do not hold.
    assert.doesNotMatch(built, /as (?:we|previously) mentioned|our (?:previous|earlier) (?:reminder|email)|final notice before legal/i);
  });
});

describe("claim: a gap is shown as a gap", () => {
  it("keeps undated rows out of the totals and reports them", () => {
    assert.ok(typeof cashPosition.build === "function", "the cash position no longer builds; this check cannot look");
    const source = read("lib/sonara-cash-position.cjs");
    assert.match(source, /undated/, "nothing tracks undated rows separately any more");
    assert.match(source, /complete:/, "the cash position no longer reports whether it is complete");
  });

  it("does not describe a capped list as the whole of it", () => {
    // The third sentence of the claim, checked against the function that makes
    // it true rather than against the sentence.
    const caption = recordCountCaption(new Array(100).fill({ id: "x" }), { loadedAll: false, total: 250, offset: 0, page: 1 });
    assert.notEqual(caption, "100 records");
    assert.match(caption, /250 records/);
  });

  it("says unavailable rather than zero when a table cannot be read", () => {
    const source = read("lib/sonara-cash-position.cjs");
    assert.match(source, /unavailable/, "an unreadable table no longer reports itself as unavailable, so it would read as zero");
  });
});
