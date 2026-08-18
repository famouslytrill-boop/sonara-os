"use strict";

// A funnel a business makes decisions on must not quietly include evidence
// somebody typed.
//
// growth_touchpoints feeds the "Reached" stage, and every drop rate below it is
// computed against that number. So a hand-entered touchpoint does not just add
// one to the top -- it moves every percentage underneath. Somebody recording
// "they mentioned it at the counter" would raise their own reach and lower their
// own apparent drop-off, and nothing would say so.
//
// The column has three answers and the third is the one these tests exist for.

const assert = require("node:assert/strict");
const { STAGES, countStage, build, validate } = require("../lib/sonara-customer-journey.cjs");

const reached = STAGES.find((stage) => stage.id === "reached");

const touchpoint = (hand_entered) => ({ id: "t", lead_id: "l", channel: "email", occurred_at: "2026-08-18T10:00:00Z", hand_entered });

describe("a typed touchpoint is not measured", () => {
  it("still describes stages against columns that exist", () => {
    // hand_entered was added by `alter table`, so this also pins that the
    // validation asks the module which knows about existence.
    assert.deepEqual(validate(), []);
    assert.ok(reached.columns.includes("hand_entered"), "the stage must select the column it filters on");
  });

  it("counts a tracked touchpoint and refuses a typed one", () => {
    assert.equal(reached.counts(touchpoint(false)), true);
    assert.equal(reached.counts(touchpoint(true)), false);
  });

  it("counts a touchpoint that predates the column", () => {
    // null is "nobody recorded which", and every row written before the column
    // existed is tracked as far as anybody knows. Treating null as hand-entered
    // would erase the entire history from the funnel.
    assert.equal(reached.counts(touchpoint(null)), true);
    assert.equal(reached.counts({ id: "t" }), true, "a row with no hand_entered at all is history, not a typed row");
  });

  it("reports the typed ones instead of dropping them", () => {
    // Excluding them silently would be as misleading as counting them. The
    // business recorded those on purpose.
    const result = countStage(reached, [
      touchpoint(false),
      touchpoint(null),
      touchpoint(true),
      touchpoint(true)
    ]);
    assert.equal(result.count, 2, "only the tracked and the historic count as measured");
    assert.equal(result.handEntered, 2, "the typed ones are reported, not discarded");
  });

  it("does not let typed touchpoints move the drop rate", () => {
    // The point of the whole change, stated as arithmetic. Two tracked
    // touchpoints and one lead is a 50% drop. Adding eight typed touchpoints
    // must not turn that into 89%.
    const measuredOnly = build([
      countStage(reached, [touchpoint(false), touchpoint(false)]),
      { id: "captured", label: "Captured as a lead", plain: "", linked: true, count: 1 }
    ]);
    const withTyped = build([
      countStage(reached, [touchpoint(false), touchpoint(false), ...Array.from({ length: 8 }, () => touchpoint(true))]),
      { id: "captured", label: "Captured as a lead", plain: "", linked: true, count: 1 }
    ]);

    const dropOf = (result) => result.stages.find((stage) => stage.id === "captured").dropRate;
    assert.equal(dropOf(measuredOnly), 50);
    assert.equal(dropOf(withTyped), 50, "typed touchpoints changed a drop rate they must not touch");
  });

  it("survives a row that is not an object", () => {
    const result = countStage(reached, [null, undefined, "nonsense", touchpoint(false)]);
    assert.equal(result.count >= 1, true);
    assert.equal(result.handEntered, 0);
  });
});
