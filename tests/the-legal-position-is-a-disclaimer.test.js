"use strict";

// /readiness reported `legalPages: review_required`.
//
// It rendered as "Legal pages: Review required", in a list beside "Payment
// connection: Missing" and "Checkout: Setup required" -- items somebody closes
// by doing something. This one nobody could close. A qualified legal review is
// a decision about engaging counsel, made outside this repository and with a
// cost, and no change to this code moves it. docs/SHIP_READINESS.md had already
// reached that conclusion and taken the item off the owner's list; the
// readiness surface had not.
//
// What is true and finished: the pages are published and every one says it is
// not legal advice. That is a disclaimer, and a disclaimer has no next step.
//
// The line this must not cross is the one that was drawn when the review-status
// sentence came off the customer-facing pages: dropping "review required" and
// asserting "reviewed" are different acts. So this checks both halves -- that
// the disclaimer is on every page, and that nothing anywhere claims a review
// that has not happened.

const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../server");
const { LEGAL_DISCLAIMER, DISCLAIMER_MARKERS, carriesDisclaimer, legalPagesStatus } = require("../lib/sonara-legal-position.cjs");

// Every route that serves legal text, read off Express rather than from a list
// here -- a hand-kept list would go stale exactly when a new legal page is
// added, which is the moment this check matters.
function legalRoutes() {
  const routes = new Set();
  (function walk(stack) {
    for (const layer of stack) {
      if (layer.route) {
        const path = layer.route.path;
        if (Object.keys(layer.route.methods).includes("get") && /^\/(legal\/|terms|privacy|refund|cookie|acceptable-use|earnings-disclaimer)/.test(path) && !path.includes(":")) {
          routes.add(path);
        }
      } else if (layer.handle && layer.handle.stack) walk(layer.handle.stack);
    }
  })(app._router.stack);
  return [...routes].sort();
}

const CLAIMS_A_REVIEW = /attorney[- ]reviewed|reviewed by (?:our |a )?(?:attorney|lawyer|counsel)|legally (?:reviewed|approved|vetted)/i;

describe("the legal position is a disclaimer, not an open task", () => {
  const routes = legalRoutes();

  it("found the legal pages, rather than checking none of them", () => {
    assert.ok(routes.length >= 5, `only ${routes.length} legal routes found; this check has gone blind`);
  });

  it("says the disclaimer on every page that serves legal text", async function render() {
    this.timeout(30000);
    const missing = [];
    for (const route of routes) {
      const response = await request(app).get(route).set("Accept", "text/html");
      assert.equal(response.status, 200, `${route} answered ${response.status}`);
      if (!carriesDisclaimer(response.text)) missing.push(route);
    }
    assert.deepEqual(missing, [], `these legal pages do not say they are not legal advice:\n  ${missing.join("\n  ")}`);
  });

  it("claims no review that has not happened, on any of them", async function render() {
    this.timeout(30000);
    const claiming = [];
    for (const route of routes) {
      const response = await request(app).get(route).set("Accept", "text/html");
      if (CLAIMS_A_REVIEW.test(response.text)) claiming.push(route);
    }
    assert.deepEqual(claiming, [], `these pages claim a legal review that has not taken place:\n  ${claiming.join("\n  ")}`);
  });

  it("reports the disclaimer on /readiness, and still reports that no attorney reviewed it", async function readiness() {
    this.timeout(20000);
    const response = await request(app).get("/api/readiness").set("Accept", "application/json");
    assert.equal(response.status, 200);
    assert.equal(response.body.services.legalPages, "published_with_disclaimer");
    // The half that must survive every future edit to the half above.
    assert.equal(response.body.services.legalReviewBoundary, "not_attorney_reviewed");
  });

  it("shows it on the readiness page as a statement rather than a pending step", async function page() {
    this.timeout(20000);
    const response = await request(app).get("/readiness").set("Accept", "text/html");
    assert.equal(response.status, 200);
    assert.match(response.text, /Legal pages/);
    assert.doesNotMatch(
      response.text,
      /Legal pages<\/h2>\s*<p>Review required/,
      "the readiness page still presents the legal pages as an outstanding review"
    );
    assert.match(response.text, /Not attorney reviewed/, "the readiness page stopped saying no attorney has reviewed these");
  });

  // The status is derived, and these are the inputs that make it wrong.
  it("does not report the good answer when there is nothing to report it about", () => {
    assert.equal(legalPagesStatus([]), "no_legal_pages");
    assert.equal(legalPagesStatus(undefined), "no_legal_pages");
    assert.equal(legalPagesStatus(null), "no_legal_pages");
  });

  it("would notice a disclaimer that stopped saying either of the two things", () => {
    assert.ok(carriesDisclaimer(LEGAL_DISCLAIMER), "the shipped disclaimer does not satisfy its own markers");
    assert.ok(DISCLAIMER_MARKERS.length >= 2, "the marker list has shrunk to nothing worth checking");
    for (const marker of DISCLAIMER_MARKERS) {
      const without = LEGAL_DISCLAIMER.replace(new RegExp(marker, "i"), "");
      assert.ok(!carriesDisclaimer(without), `dropping "${marker}" from the disclaimer still counts as carrying it`);
    }
  });

  it("keeps the review tracked where it belongs, rather than deleting the question", () => {
    // Taking the item off a readiness list is not deciding the review is
    // unnecessary. The two documents that hold the question have to still hold
    // it, or this change would have quietly answered it.
    const fs = require("node:fs");
    const path = require("node:path");
    for (const file of ["docs/legal/LEGAL_REVIEW_REQUIRED.md", "docs/legal/COUNSEL_REVIEW_BRIEF.md"]) {
      const full = path.join(__dirname, "..", file);
      assert.ok(fs.existsSync(full), `${file} is gone; the legal review is now tracked nowhere`);
      assert.ok(fs.readFileSync(full, "utf8").length > 400, `${file} has been emptied`);
    }
  });
});
