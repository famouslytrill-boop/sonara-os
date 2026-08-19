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
const ORPHAN_DISPOSITIONS = Object.freeze({
  // ---------------------------------------------------------------------------
  // The ten below share one cause, found 19 August 2026.
  //
  // Each is queried only by TypeScript that cannot run. `next` and `react` are
  // not dependencies of this project, `pnpm run build` is `node --check
  // server.js`, and vercel.json bundles `{public/**,routes/**,lib/**}` into one
  // Express function with every route rewritten to it. There is no TypeScript
  // compilation anywhere in the deploy -- yet the repository holds 1,165
  // .ts/.tsx files including an `app/` directory of 231 Next.js pages.
  //
  // scripts/report-orphan-tables.mjs used to count a .ts file as usage, so it
  // reported "0 tables created and never queried" while these ten were exactly
  // that from the running application's point of view. The scan now reads only
  // .cjs/.js/.mjs/.json, which is what ships.
  //
  // Every decision here is "keep", and none of them is a recommendation to
  // build. Whether that Next.js application is revived, deleted, or left as an
  // unbuilt reference is an owner decision with three very different costs, and
  // it is recorded in docs/SHIP_READINESS.md rather than settled here.
  // ---------------------------------------------------------------------------
  creator_activity_events: Object.freeze({
    group: "unbuilt-typescript",
    decision: "keep",
    note:
      "Per-route analytics for Creator Studio -- event_name, route, product_area. The shipped product records activity in activity_events and audit_events instead, so this is a second answer to the same question from the unbuilt app. Do not wire it without deciding which of the two is the record."
  }),
  db_health_snapshots: Object.freeze({
    group: "unbuilt-typescript",
    decision: "keep",
    note:
      "check_name, status, score -- a health dashboard's storage. /readiness and scripts/verify-production-supabase.mjs answer the same question live rather than from stored snapshots, which is the better shape: a stored health score is stale the moment it is written."
  }),
  feedback_reports: Object.freeze({
    group: "unbuilt-typescript",
    decision: "keep",
    note:
      "In-product feedback: page_path, rating, message, email. The shipped product routes this through support_requests and /contact. A genuine gap if per-page feedback is wanted, and a real feature rather than a wiring job -- it needs a widget, a moderation view and a retention answer."
  }),
  sonara_generation_history: Object.freeze({
    group: "unbuilt-typescript",
    decision: "keep",
    note:
      "engine_name, input_hash, settings_snapshot, parent_id -- lineage for regenerating a creative output from the same inputs. creator_generation_jobs is the live equivalent and has no parent_id, so this table anticipates a chained pipeline the shipped product cannot express. Worth reading before any multi-step generation work."
  }),
  sonara_memory_records: Object.freeze({
    group: "unbuilt-typescript",
    decision: "keep",
    note:
      "kind, title, content and an embedding column -- semantic memory for an assistant. Nothing in the shipped product computes or stores embeddings, and doing so is a provider cost per record rather than a wiring job."
  }),
  sonara_projects: Object.freeze({
    group: "unbuilt-typescript",
    decision: "keep",
    note:
      "Creative projects: title, project_type, genre, creator_name. lib/sonara/projects/projectStore.ts reads and writes it and cannot run. music_projects is the live table with a page at /creator-studio/music-projects, so this is the unbuilt app's parallel version -- two tables for one idea, and the live one already works."
  }),
  sonara_sound_assets: Object.freeze({
    group: "unbuilt-typescript",
    decision: "keep",
    note:
      "license, redistribution_category, commercial_use_allowed, attribution_required -- a licensing model for third-party audio, and the most interesting of the ten. data/open-source-tools.ts does this job for code; nothing does it for sound. Read it before any stock-audio feature."
  }),
  sonara_sound_sources: Object.freeze({
    group: "unbuilt-typescript",
    decision: "keep",
    note:
      "The providers sound assets come from, with an `enabled` flag. Same decision as sonara_sound_assets and the same reason to read rather than wire."
  }),
  sonara_user_subscriptions: Object.freeze({
    group: "unbuilt-typescript",
    decision: "keep",
    note:
      "stripe_customer_id, stripe_subscription_id, tier, cancel_at_period_end -- a THIRD billing model, alongside the live billing_subscriptions and billing_entitlements that lib/sonara-paid-entitlement.cjs actually reads. Wiring this would give paid access two answers, which is the drift this codebase keeps finding. Leave it."
  }),
  system_audit_events: Object.freeze({
    group: "unbuilt-typescript",
    decision: "keep",
    note:
      "actor_id, entity_type, severity -- a general audit log. The shipped product has audit_events, audit_logs, agent_action_logs and business_control_audit_events. A fifth is not the gap; consolidating the four might be."
  }),
});

const ORPHAN_TABLES = Object.freeze(Object.keys(ORPHAN_DISPOSITIONS).sort());

function dispositionFor(table) {
  return ORPHAN_DISPOSITIONS[String(table || "")] || null;
}

function tablesWithDecision(decision) {
  return ORPHAN_TABLES.filter((table) => ORPHAN_DISPOSITIONS[table].decision === decision);
}

module.exports = { ORPHAN_TABLES, ORPHAN_DISPOSITIONS, dispositionFor, tablesWithDecision };
