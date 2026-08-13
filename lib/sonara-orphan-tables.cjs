"use strict";

// Every table the migrations create that the application never queries, with a
// decision recorded against each one.
//
// docs/WORKSPACE_WORKFLOW_AUDIT.md reported 206 of 300 and said removing them
// needs owner approval. Two things had to change before that approval could
// mean anything.
//
// The count could not be reproduced. "Named anywhere in the application source"
// gives 0 if docs/ counts as source, because the audit lists every orphan by
// name; it gives 0 again if the generated inventories count, because
// lib/sonara-database-contract.cjs and lib/sonara-tenant-scoped-tables.cjs name
// every table by construction. Measured as "no file that queries anything names
// it" -- and not counting a name that only appears in a comment -- it was 90.
// It is 32: three became Business Builder workspaces, four more became line
// items inside those records, and 51 became readable at
// /research-lab/subsystems. scripts/report-orphan-tables.mjs is that
// measurement, so the number is recomputed on every run rather than asserted
// here, and it failed until this file was brought back in step.
//
// And "drop them" was the wrong action for most of the list. What remains falls
// into three kinds, and only one is a deletion:
//
//   superseded -- an earlier generation of a table that is live under another
//     name. campaigns/growth_campaigns, billing_customers/stripe_customers.
//     These are the real retirement candidates, and they are the ones that make
//     the schema misleading: open the database, find the table with the obvious
//     name, and it is empty and always will be.
//
//   buildable -- an ordinary feature with a real schema, no code, and an
//     obvious place in an existing workspace. Three became pages in the change
//     that added this file.
//
//   system -- written by infrastructure rather than the application: rate
//     limits, audit trails, observability. Absence from application source is
//     expected, not a finding.
//
// The thirteen superseded tables are retired by
// supabase/migrations/20260805120000_retire_superseded_tables.sql, which moves
// them to a `retired` schema rather than dropping them -- nothing in this
// repository can establish whether they hold rows, and a migration that assumes
// they are empty destroys data if they are not. They stay listed here until
// that migration has run everywhere.

// Empty, and that is the finished state rather than a gap.
//
// It held 206 (claimed), then 90 (measured), then 87, 36, 32, 19 and now none.
// Thirteen superseded tables were dropped. The rest were built: three became
// Business Builder operations workspaces, four became line items inside the
// records they belong to, two became supplier payments and accounting exports,
// and sixty-eight are readable at /research-lab/subsystems, fifty of them
// writable.
//
// The gate does not go quiet now that this is empty, and that mattered more
// than emptying it. scripts/report-orphan-tables.mjs computes the orphan set
// from the migrations and the code on every run; an empty list here means it
// found none, and the moment somebody adds a table nothing reads, --check fails
// and the table has to be built or classified. tests/orphan-tables.test.js
// asserts the script still fails on an unclassified orphan, so an empty
// registry cannot be mistaken for a working one.
// The five artist-system tables are built and are no longer here.
//
// They were re-orphaned by deleting routes/creator-artist-system-routes.cjs --
// the only code that read them, required by nothing, so its routes 404ed and
// the tables were never actually reached in production either. The decision
// recorded against them was: build the artist workspace properly, from the real
// columns, or drop the tables. It was built.
//
// /creator-studio/artists and the four pages beside it read and write
// creator_artist_profiles, creator_sonic_profiles, creator_album_cycles,
// creator_prompt_blueprints and creator_video_treatments through the same
// record-page machinery as everything else, so there is no second code path to
// fall out of use the way that module did.
const ORPHAN_DISPOSITIONS = Object.freeze({});

const ORPHAN_TABLES = Object.freeze(Object.keys(ORPHAN_DISPOSITIONS).sort());

function dispositionFor(table) {
  return ORPHAN_DISPOSITIONS[String(table || "")] || null;
}

function tablesWithDecision(decision) {
  return ORPHAN_TABLES.filter((table) => ORPHAN_DISPOSITIONS[table].decision === decision);
}

module.exports = { ORPHAN_TABLES, ORPHAN_DISPOSITIONS, dispositionFor, tablesWithDecision };
