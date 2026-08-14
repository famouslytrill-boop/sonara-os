"use strict";

// The journey view, and the number it refuses to make up.
//
// Stage counts are easy. The tempting part is the drop between them -- "you
// lost 60% between enquiry and booking" is the sentence an owner wants, and in
// this schema it is not available: business_bookings carries no lead_id, so a
// booking cannot be traced to the lead that produced it. Printing the ratio
// anyway would produce a number that looks exactly like a measurement.
//
// So a drop rate is reported only between stages that both declare `linked`,
// and `linked` is checked against the schema rather than trusted. Everything
// else is a count standing beside the others, labelled as one.

const assert = require("node:assert/strict");
const { STAGES, validate, selectFor, countStage, build } = require("../lib/sonara-customer-journey.cjs");

function rowsFor(id, count) {
  const rows = [];
  for (let index = 0; index < count; index += 1) {
    if (id === "reached") rows.push({ id: String(index), lead_id: `lead-${index}`, channel: "email" });
    else if (id === "captured") rows.push({ id: String(index), email: `a${index}@example.com`, status: "new" });
    else if (id === "reachable") rows.push({ id: String(index), email: `a${index}@example.com`, status: "new" });
    else if (id === "converted") rows.push({ id: String(index), lead_id: `lead-${index}`, value: 100 });
    else if (id === "booked") rows.push({ id: String(index), status: "confirmed" });
    else if (id === "served") rows.push({ id: String(index), status: "completed" });
    else rows.push({ id: String(index), rating: 5, status: "published" });
  }
  return rows;
}

function journeyOf(counts) {
  return build(STAGES.map((stage) => countStage(stage, rowsFor(stage.id, counts[stage.id] ?? 0))));
}

describe("the customer journey view", () => {
  it("names only columns the schema actually has", () => {
    assert.deepEqual(validate(), [], "these stages reference columns or tables supabase/migrations does not define");
  });

  it("asks for the columns it reads and no more", () => {
    for (const stage of STAGES) {
      const select = selectFor(stage).split(",");
      assert.ok(select.includes("id"), `${stage.id} must select id`);
      assert.ok(!select.includes("organization_id"), `${stage.id} selects organization_id; the tenant filter carries it`);
    }
  });

  it("reports a drop only where a lead can actually be traced", () => {
    const journey = journeyOf({ reached: 100, captured: 40, reachable: 30, converted: 6, booked: 20, served: 15, reviewed: 3 });

    const converted = journey.stages.find((stage) => stage.id === "converted");
    assert.equal(converted.dropRate, 80, "reachable 30 to converted 6 is an 80% drop and both stages carry lead_id");

    for (const id of ["booked", "served", "reviewed"]) {
      const stage = journey.stages.find((entry) => entry.id === id);
      assert.equal(
        stage.dropRate,
        null,
        `${id} has no lead_id in the schema, so any drop rate against the previous stage would be invented`
      );
    }
  });

  it("does not report a drop of zero when it means 'no relationship'", () => {
    // null and 0 render differently and mean opposite things. A caller that
    // treated a missing relationship as 0 would print "0% lost" for a
    // comparison that was never a funnel.
    const journey = journeyOf({ reached: 10, captured: 10, reachable: 10, converted: 10, booked: 0, served: 0, reviewed: 0 });
    const booked = journey.stages.find((stage) => stage.id === "booked");
    assert.equal(booked.dropRate, null);
    assert.notEqual(booked.dropRate, 0);
  });

  it("keeps stages that counted nothing", () => {
    // A business with no reviews has an empty stage, not a missing one. Hiding
    // it makes "nobody reviewed you" and "we did not look" identical.
    const journey = journeyOf({});
    assert.equal(journey.stages.length, STAGES.length);
    assert.equal(journey.total, 0);
    assert.equal(journey.worst, null, "with nothing recorded there is no worst drop to name");
  });

  it("names the biggest traceable drop and ignores the untraceable ones", () => {
    const journey = journeyOf({ reached: 1000, captured: 100, reachable: 95, converted: 90, booked: 1, served: 0, reviewed: 0 });
    assert.equal(journey.worst.id, "captured", "1000 reached to 100 captured is the biggest drop that can be traced");
    // booked falls from 90 to 1, which is a larger fall and not a traceable one.
    assert.notEqual(journey.worst.id, "booked");
  });

  it("survives malformed rows rather than failing the page", () => {
    for (const stage of STAGES) {
      assert.doesNotThrow(() => countStage(stage, [null, {}, { id: "x" }]));
    }
  });

  it("says in plain words what each stage is", () => {
    for (const stage of STAGES) {
      assert.ok(stage.plain && stage.plain.length > 20, `${stage.id} has no plain-language description`);
    }
    // The unlinked stages have to say so on screen, not just in a boolean.
    for (const stage of STAGES.filter((entry) => !entry.linked)) {
      assert.match(
        stage.plain,
        /count|not linked/i,
        `${stage.id} is not linked to the stage before it and its description does not say so`
      );
    }
  });
});
