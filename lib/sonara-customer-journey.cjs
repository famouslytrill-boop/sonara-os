"use strict";

// Where customers fall out, counted from the business's own records.
//
// lib/sonara-record-checks.cjs answers "what is broken". This answers a
// different question: how many people are at each stage, and where the number
// drops. An owner can have nothing broken and still be losing everybody between
// enquiry and booking, and no check in this product would say so.
//
// The honest part is which drops are real.
//
// growth_touchpoints, growth_leads and growth_conversions all carry lead_id, so
// a conversion can be traced back to the lead it came from. That is a funnel:
// the same person moving through stages.
//
// business_bookings and reviews carry no lead_id. A booking is not linked to the
// lead that produced it, and a review is linked to a customer rather than to a
// lead. Putting those in the same column and calling the difference a
// conversion rate would invent a relationship the schema does not have -- and it
// would look exactly like a real number, which is the failure this codebase
// keeps producing.
//
// So stages carry a `linked` flag. Linked stages report a rate. Unlinked ones
// report a count and say plainly that it is a count.

const { tableColumns } = require("./sonara-migration-columns.cjs");

// Two different questions, and this file was asking one with the other's answer.
//
// It used `describedColumns`, which returns the columns a form could be built
// from: the ones declared inside a `create table` block, with a parsed type. It
// deliberately omits columns added later by `alter table`, because that module
// would rather offer no field than one with a guessed type, and it says so.
//
// `validate` below is not building a form. It asks whether a column exists, and
// 35 columns across 22 tables exist without being describable. A stage naming
// one of those would have been reported as "no column" -- a false answer to the
// question actually being asked, waiting for the first stage to reference a
// column somebody added later.
//
// Nothing in this file needed a type, which is why the describable set went out
// with the switch rather than staying beside it.
function existingColumns(table) {
  const all = tableColumns(table);
  return all ? [...all] : [];
}

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === "";
}

// Ordered as the customer moves. `linked` says whether this stage can be traced
// back to the previous one by a foreign key that actually exists.
const STAGES = Object.freeze([
  Object.freeze({
    id: "reached",
    label: "Reached",
    table: "growth_touchpoints",
    columns: ["id", "lead_id", "channel", "occurred_at", "hand_entered"],
    linked: true,
    // Measured touchpoints only.
    //
    // `hand_entered` is true when a person typed the row into a form. Counting
    // those here would let somebody raise the top of their own funnel by typing,
    // and every drop rate below is computed against this number -- so a typed
    // touchpoint does not just add one, it moves every percentage under it.
    //
    // `!== true` rather than `=== false`, because the column has three answers
    // and the third is null: rows written before the column existed were not
    // hand-entered as far as anybody knows, and they are the tracked ones.
    // Treating null as hand-entered would erase the entire history.
    //
    // The typed ones are not hidden. countStage reports them separately, and a
    // page that shows a funnel without saying how many were typed is telling
    // half of this.
    counts: (row) => row.hand_entered !== true,
    plain: "Someone interacted with something you put out."
  }),
  Object.freeze({
    id: "captured",
    label: "Captured as a lead",
    table: "growth_leads",
    columns: ["id", "name", "email", "phone", "source", "status"],
    linked: true,
    counts: () => true,
    plain: "They left you enough to follow up."
  }),
  Object.freeze({
    id: "reachable",
    label: "Actually reachable",
    table: "growth_leads",
    columns: ["id", "email", "phone", "status"],
    linked: true,
    counts: (row) => !isBlank(row.email) || !isBlank(row.phone),
    plain: "A lead with no email and no phone is not a lead."
  }),
  Object.freeze({
    id: "converted",
    label: "Converted",
    table: "growth_conversions",
    columns: ["id", "lead_id", "conversion_type", "value", "occurred_at"],
    linked: true,
    counts: (row) => !isBlank(row.lead_id),
    plain: "A recorded conversion traceable to the lead it came from."
  }),
  Object.freeze({
    id: "booked",
    label: "Booked",
    table: "business_bookings",
    columns: ["id", "status", "starts_at"],
    linked: false,
    counts: (row) => {
      const status = String(row.status || "").toLowerCase();
      return status !== "cancelled" && status !== "no_show";
    },
    plain: "Bookings on the books. A booking is not tied to the lead it came from, so this is a count beside the others rather than a step after them."
  }),
  Object.freeze({
    id: "served",
    label: "Served",
    table: "business_bookings",
    columns: ["id", "status"],
    linked: false,
    counts: (row) => String(row.status || "").toLowerCase() === "completed",
    plain: "Bookings marked completed. A count, like the one above it -- a booking is not tied to the lead it came from."
  }),
  Object.freeze({
    id: "reviewed",
    label: "Reviewed",
    table: "reviews",
    columns: ["id", "rating", "status"],
    linked: false,
    counts: () => true,
    plain: "Reviews on file. Linked to a customer rather than to a lead, so this is a count too."
  })
]);

// Same guarantee as the record checks: no column typed from memory.
function validate() {
  const problems = [];
  for (const stage of STAGES) {
    const available = existingColumns(stage.table);
    if (available.length === 0) {
      problems.push(`${stage.id}: no table named ${stage.table} in supabase/migrations`);
      continue;
    }
    for (const column of stage.columns) {
      if (!available.includes(column)) problems.push(`${stage.id}: ${stage.table} has no column ${column}`);
    }
    if (!available.includes("organization_id")) {
      problems.push(`${stage.id}: ${stage.table} has no organization_id, so this stage cannot be scoped to one business`);
    }
    // A stage claiming to be linked has to have the key that links it.
    if (stage.linked && stage.table !== "growth_leads" && !available.includes("lead_id")) {
      problems.push(`${stage.id}: declared linked, but ${stage.table} has no lead_id to link by`);
    }
  }
  return problems;
}

function selectFor(stage) {
  return [...new Set(stage.columns)].join(",");
}

function countStage(stage, rows) {
  const list = Array.isArray(rows) ? rows : [];
  let count = 0;
  // Rows a person typed, counted separately rather than dropped. A stage that
  // silently excluded them would be as misleading as one that counted them: the
  // business recorded those touchpoints on purpose and is entitled to see them,
  // just not inside a measured figure.
  let handEntered = 0;
  for (const row of list) {
    try {
      if (row && row.hand_entered === true) handEntered += 1;
      if (stage.counts(row)) count += 1;
    } catch {
      // A malformed row is not a customer.
    }
  }
  return { id: stage.id, label: stage.label, plain: stage.plain, linked: stage.linked, count, handEntered };
}

// The drop between two stages, reported only where the schema supports it.
//
// `null` is deliberate and is not zero. A caller rendering `dropRate` has to
// decide what to show when there is no traceable relationship, and returning 0
// would let it print "0% lost" for a comparison that was never a funnel.
function build(results) {
  const ordered = STAGES.map((stage) => results.find((result) => result.id === stage.id) || countStage(stage, []));
  const stages = ordered.map((result, index) => {
    const previous = index > 0 ? ordered[index - 1] : null;
    const comparable = Boolean(previous && previous.linked && result.linked);
    const dropRate = comparable && previous.count > 0
      ? Math.max(0, Math.round((1 - result.count / previous.count) * 100))
      : null;
    return { ...result, dropRate, comparedWith: comparable ? previous.label : null };
  });

  // The biggest traceable drop is the one sentence worth putting at the top.
  const traceable = stages.filter((stage) => stage.dropRate !== null);
  const worst = traceable.reduce((leader, stage) => (!leader || stage.dropRate > leader.dropRate ? stage : leader), null);

  return {
    stages,
    traceableStages: traceable.length,
    countOnlyStages: stages.length - traceable.length - 1,
    worst: worst && worst.dropRate > 0 ? worst : null,
    total: stages.reduce((sum, stage) => sum + stage.count, 0)
  };
}

module.exports = {
  STAGES,
  validate,
  selectFor,
  countStage,
  build
};
