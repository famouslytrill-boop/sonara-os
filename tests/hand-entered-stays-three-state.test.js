"use strict";

// `hand_entered` has three answers and must keep having three.
//
//   true   a person typed this row into a form
//   false  it arrived tracked, imported, or curated
//   null   nobody recorded which, because the row predates the column
//
// The tidy-up that would break this is obvious and well-intentioned: make it
// `boolean not null default false`, so callers stop handling null. That would
// write a claim about every row already in both tables -- that each is *known*
// to be machine-recorded -- on the strength of nothing at all. It is the same
// collapse this repository keeps finding, where a failed read and an empty
// result reach the same conclusion, and it would be introduced here on purpose.
//
// growth_touchpoints is the one that matters. It feeds the "Reached" stage of
// the customer journey in lib/sonara-customer-journey.cjs, so a hand-entered
// touchpoint counted as measured inflates a funnel a business makes decisions
// on. A null must never be read as "not hand-entered".

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const MIGRATION = path.join(__dirname, "..", "supabase", "migrations", "20260818090000_hand_entered_provenance.sql");
const TABLES = ["growth_touchpoints", "sonara_prompt_templates"];

describe("hand_entered stays three-state", () => {
  const sql = fs.readFileSync(MIGRATION, "utf8");

  it("adds the column to both tables that were blocked on it", () => {
    // Without this the checks below can pass by looking at a migration that no
    // longer adds anything.
    for (const table of TABLES) {
      assert.match(
        sql,
        new RegExp(`alter table if exists public\\.${table}\\s+add column if not exists hand_entered boolean`, "i"),
        `${table} no longer gets a hand_entered column`
      );
    }
  });

  it("leaves it nullable, with no default", () => {
    for (const table of TABLES) {
      const clause = new RegExp(`alter table if exists public\\.${table}\\s+add column if not exists hand_entered boolean([^;]*);`, "i");
      const found = clause.exec(sql);
      assert.ok(found, `no hand_entered clause found for ${table}`);
      const tail = String(found[1] || "");
      assert.doesNotMatch(tail, /not\s+null/i, `${table}.hand_entered was made NOT NULL, which erases the "nobody recorded which" answer`);
      assert.doesNotMatch(tail, /default/i, `${table}.hand_entered was given a default, which claims something about every existing row`);
    }
  });

  it("says in the database what the three answers mean", () => {
    // A comment on the column is the only documentation somebody reading the
    // schema will have, and this distinction is not guessable from the type.
    for (const table of TABLES) {
      assert.match(
        sql,
        new RegExp(`comment on column public\\.${table}\\.hand_entered is`, "i"),
        `${table}.hand_entered has no column comment explaining null`
      );
    }
    assert.match(sql, /null when nobody recorded which/i);
  });

  it("does not backfill", () => {
    // An UPDATE setting existing rows either way would be the same claim as a
    // default, written a different way.
    assert.doesNotMatch(sql, /update\s+public\.(growth_touchpoints|sonara_prompt_templates)/i);
  });
});
