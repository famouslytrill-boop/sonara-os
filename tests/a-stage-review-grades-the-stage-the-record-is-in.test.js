"use strict";

// `/product-lifecycle` decides what ships. A stage review is the record of that
// decision, and an `advance` or `scale` review is gated on a readiness score
// computed **for the stage the initiative is in** -- different stages have
// different criteria, and a discover-stage initiative graded against
// discover-stage criteria is not the same thing as one graded against
// learn_scale criteria.
//
// So where the stage comes from is the whole gate. `addStageReview` reads it
// from `bundle.body.initiative.lifecycle_stage` -- the row, fetched from the
// database inside the same request -- and not from the form. That is right, and
// nothing said so, and a hidden `<input name="stage">` sat in the form until
// 3 September 2026 suggesting the opposite. It was submitted on every review and
// ignored on every one.
//
// Harmless as it stood. The danger is the premise: it reads as though the stage
// travels with the review, which is exactly what somebody would believe while
// "fixing" the handler to use the value the form so obviously provides. That
// change compiles, passes review, and hands the requester the choice of which
// criteria they are graded against.
//
// This file is the two halves of that, so neither can quietly stop being true.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const SOURCE = fs
  .readFileSync(path.join(__dirname, "..", "routes", "product-lifecycle-routes.cjs"), "utf8")
  .replace(/\r\n/g, "\n");

/** The named function's body, to its closing brace at column 0. */
function functionBody(name) {
  const start = SOURCE.indexOf(`function ${name}(`);
  assert.ok(start > 0, `${name} is no longer defined in product-lifecycle-routes.cjs`);
  const end = SOURCE.indexOf("\n}\n", start);
  assert.ok(end > start, `could not find the end of ${name}`);
  return SOURCE.slice(start, end);
}

describe("a stage review grades the stage the record is in", () => {
  describe("the harness is capable of failing", () => {
    it("read the file it is asserting about", () => {
      assert.ok(SOURCE.length > 20000, "product-lifecycle-routes.cjs came back too small; this check has gone blind");
      assert.match(SOURCE, /function addStageReview/, "the stage review handler is gone");
      assert.match(SOURCE, /function reviewForm/, "the stage review form is gone");
    });
  });

  it("takes the stage from the initiative row, not from the request", () => {
    const handler = functionBody("addStageReview");
    assert.match(
      handler,
      /stage: bundle\.body\.initiative\.lifecycle_stage/,
      "the review no longer records the stage read back from the database"
    );
    assert.doesNotMatch(
      handler,
      /stage:\s*[^\n]*req\.body/,
      "the stage written on a review now comes from the request. Whoever posts the review then chooses which " +
        "stage's criteria the readiness gate grades them against"
    );
  });

  it("grades readiness against that same stage rather than a submitted one", () => {
    const handler = functionBody("addStageReview");
    assert.match(handler, /readiness\.score < 70/, "the 70-point advance gate is gone");
    assert.match(
      handler,
      /const readiness = bundle\.body\.readiness/,
      "readiness no longer comes from the loaded bundle, so it may now be graded against something the caller sent"
    );
  });

  it("does not offer a stage field for the handler to be tempted by", () => {
    const form = functionBody("reviewForm");
    assert.doesNotMatch(
      form,
      /name="(stage|lifecycle_stage)"/,
      "the review form carries a stage field again. The handler ignores it today, which makes it dead weight that " +
        "reads like a working input -- and the obvious next edit is to start trusting it"
    );
    // Without this the assertion above would pass on an empty form.
    assert.match(form, /name="decision"/, "the review form no longer has a decision field; this check has gone blind");
    assert.match(form, /name="rationale"/, "the review form no longer has a rationale field; this check has gone blind");
  });

  it("still refuses an advance that has not met the bar", () => {
    // The gate the two assertions above exist to protect. If this stops being
    // here they are guarding nothing.
    const handler = functionBody("addStageReview");
    assert.match(handler, /stage_gate_not_ready/, "an under-threshold advance no longer has its own refusal code");
    assert.match(handler, /stage_gate_blocked/, "a blocked advance no longer has its own refusal code");
    assert.match(
      handler,
      /\["advance", "scale"\]\.includes\(decision\)/,
      "advance and scale are no longer the decisions the readiness gate applies to"
    );
  });
});
