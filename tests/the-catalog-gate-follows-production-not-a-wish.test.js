"use strict";

// A deploy gate that could only pass while the product was still broken.
//
// Deployment #133 was the first run in 133 to reach step 30, "Verify production
// catalog pages and configured plan infrastructure". It had already deployed --
// step 28 succeeded, production moved off eebc80c -- and then step 30 failed:
//
//     AssertionError: Production catalog is missing boundary text:
//     not open yet — we are still checking this one.
//
// The page was right and the gate was wrong. That sentence, and the four others
// in CATALOG_BOUNDARY_TEXT, are rendered only by the `else` branch of
// catalogActions in routes/sonara-service-lifecycle-routes.cjs, reached when a
// product is *not* open. All 42 products are active and execution-enabled, so
// the live page says "You can use this now." and never needs the other wording.
//
// Requiring all five unconditionally made this a gate that gets harder to
// satisfy the better the product gets: to keep it green, some product would
// have to stay shut. Promoting the last beta products -- deliberate work,
// recorded in docs/SPRINT_LOG.md -- is what finally broke it.
//
// The same discovery was already made one layer down and not carried across.
// routes/sonara-service-lifecycle-routes.cjs says catalogRequestLabel was moved
// out of catalogActions because "once every product in the catalog was open,
// there was no closed product to find, so the only check on this wording went
// vacuous". That fix reached the offline test and never reached the gate.
//
// WHY THIS TEST CAN EXIST AT ALL. The rule was inline in
// scripts/verify-production-product-catalog.mjs, which needs production
// credentials to run, so nothing could exercise it and it was wrong for a month
// before a deployment got far enough to say so. It now lives in
// lib/sonara-catalog-boundary.cjs as a pure function, and this runs it against
// the real page production served on 8 September 2026.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { catalogPageAccessViolations } = require("../lib/sonara-catalog-boundary.cjs");
const { ACCESS_REASONS } = require("../lib/sonara-plain-language.cjs");

const fixturePath = path.join(__dirname, "fixtures", "production-service-catalog-2026-09-08.txt");
const productionPage = fs.readFileSync(fixturePath, "utf8");

describe("the catalog gate follows production rather than a wish", () => {
  it("reads a real page, not an empty fixture", () => {
    // Shape 1: an empty or truncated fixture would make every case below pass
    // by describing nothing.
    assert.ok(
      productionPage.length > 5000,
      `the production catalog fixture is only ${productionPage.length} characters; this check has gone blind`
    );
    assert.ok(
      productionPage.includes("you can use this now."),
      "the fixture no longer contains the open-access note, so it is not the page this test is about"
    );
  });

  it("passes on the page production actually serves, with every product open", () => {
    // This is deployment #133's failure, as a test. It must be green.
    assert.deepEqual(
      catalogPageAccessViolations({ visibleText: productionPage, accessReasonCounts: { open: 42 } }),
      [],
      "the live production catalog page fails the access-boundary rule, which is what failed deployment #133"
    );
  });

  it("still fails when a product is shut and the page does not say so", () => {
    // The promise the gate exists for. Nothing about following production's
    // state may weaken this.
    const violations = catalogPageAccessViolations({
      visibleText: productionPage,
      accessReasonCounts: { open: 41, awaiting_review: 1 }
    });
    assert.equal(violations.length, 1, `expected exactly one violation, got: ${JSON.stringify(violations)}`);
    assert.match(violations[0], /says so for none of them/);
  });

  it("fails the other way too, when the page claims a product is shut and none is", () => {
    const pretendShut = `${productionPage} ${ACCESS_REASONS.awaiting_review} ask about this one see what is ready now`;
    const violations = catalogPageAccessViolations({
      visibleText: pretendShut,
      accessReasonCounts: { open: 42 }
    });
    assert.equal(violations.length, 1, `expected exactly one violation, got: ${JSON.stringify(violations)}`);
    assert.match(violations[0], /while every production row is open/);
  });

  it("requires the way to ask, whenever a product is shown as shut", () => {
    // Told no, and given somewhere to go. A page that says "not open yet" and
    // offers nothing is the failure the original gate was written to prevent,
    // and it is still caught.
    const shutWithNoRoute = `catalog ${ACCESS_REASONS.awaiting_review}`;
    const violations = catalogPageAccessViolations({
      visibleText: shutWithNoRoute,
      accessReasonCounts: { open: 41, awaiting_review: 1 }
    });
    assert.ok(violations.some((line) => /See what is ready now/.test(line)), JSON.stringify(violations));
    assert.ok(violations.some((line) => /Ask about this one/.test(line)), JSON.stringify(violations));
    assert.ok(violations.some((line) => /told no and given no way to ask/.test(line)), JSON.stringify(violations));
  });

  it("refuses a page that rendered no access notes at all", () => {
    // Without this the rule passes on an empty page: no notes means no
    // non-open notes means nothing to require.
    const violations = catalogPageAccessViolations({ visibleText: "", accessReasonCounts: { open: 42 } });
    assert.equal(violations.length, 1);
    assert.match(violations[0], /carries no access note at all/);
  });

  it("keeps the gate reading the shared rule rather than a list of wishes", () => {
    const gate = fs.readFileSync(path.join(__dirname, "..", "scripts", "verify-production-product-catalog.mjs"), "utf8");
    const code = gate.split("\n").filter((line) => !line.trim().startsWith("//")).join("\n");
    assert.match(code, /catalogPageAccessViolations\(\{/, "the gate no longer calls the shared rule");
    assert.doesNotMatch(
      code,
      /CATALOG_BOUNDARY_TEXT/,
      "the gate is requiring every boundary string unconditionally again, which can only pass while a product is shut"
    );
  });
});
