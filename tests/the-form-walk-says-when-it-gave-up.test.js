"use strict";

// `data/capability-inventory.json` records which UI form posts to which route,
// and `formActionsWithoutRegisteredRoute` in its summary is the check that each
// form points at a route the application serves. Both are only as good as the
// walk that finds the forms.
//
// That walk follows function calls out of a page handler, and it has a budget.
// The budget was 40 resolved function bodies per page, and 40 was binding:
// measured on 1 October 2026, raising it to 120 took the recorded link count
// from 50 to 53 and brought back the billing checkout, the billing portal and
// the employee invite. Nothing in the output said those pages had been cut
// short, so the figure read as a complete census of the application's forms
// while being an incomplete one -- and which forms were missing depended on
// which names the scanner happened to resolve first, so it moved on edits that
// had nothing to do with forms.
//
// The budget still exists, because an unbounded walk over a call graph is slow
// on a bad day. This file is the part that makes it honest: if it ever binds
// again, the count stops being zero and this fails with the pages named.

const assert = require("node:assert/strict");
const inventory = require("../data/capability-inventory.json");

describe("the form walk says when it gave up", () => {
  it("records the budget it ran under, so a reader can tell what was bounded", () => {
    assert.equal(typeof inventory.summary.formWalkFunctionBudget, "number");
    assert.ok(
      inventory.summary.formWalkFunctionBudget >= 120,
      `the budget is ${inventory.summary.formWalkFunctionBudget}; it was measured as binding below 120 on 1 October 2026`
    );
  });

  it("truncated no page", () => {
    const truncated = inventory.summary.pagesTruncatedByFormWalkBudget;
    assert.ok(Array.isArray(truncated), "the summary no longer reports which pages were truncated");
    assert.deepEqual(
      truncated,
      [],
      "the form walk ran out of budget on these pages, so their forms are missing from the inventory. "
        + "Raise FORM_WALK_FUNCTION_BUDGET in scripts/generate-capability-inventory.cjs and regenerate."
    );
  });

  // The two assertions above would both pass against an inventory that found no
  // forms at all: an empty list truncates nothing. This is the one that notices.
  it("found a population of forms worth bounding", () => {
    assert.ok(
      inventory.uiFormActionLinks.length >= 50,
      `only ${inventory.uiFormActionLinks.length} UI form links recorded; this check has gone blind`
    );
    assert.equal(
      inventory.uiFormActionLinks.length,
      inventory.summary.formActionLinkCount,
      "the summary count and the list disagree"
    );
    const withFields = inventory.uiFormActionLinks.filter((link) => link.formFieldNamesObserved.length > 0);
    assert.ok(
      withFields.length >= 25,
      `only ${withFields.length} of ${inventory.uiFormActionLinks.length} links recorded any field name; the walk is reaching the tags and not their bodies`
    );
  });

  // The three that the old budget dropped, named rather than left to a count.
  // A count can be restored by finding three unrelated forms.
  it("records the three forms the old budget dropped", () => {
    const recorded = new Set(inventory.uiFormActionLinks.map((link) => `${link.method} ${link.action}`));
    for (const operation of [
      "POST /api/billing/create-checkout-session",
      "POST /api/billing/create-portal-session",
      "POST /api/business-builder/employees/invite"
    ]) {
      assert.ok(recorded.has(operation), `${operation} is not recorded; the form walk is being cut short again`);
    }
  });
});
