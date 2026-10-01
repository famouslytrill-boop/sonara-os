// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Table pairs whose columns are near-identical and which are reviewed as
// deliberate rather than duplicated.
//
// scripts/report-duplicate-tables.mjs compares every pair of tables the
// migrations create and fails on one that is not accounted for here. The
// register is two-sided: an entry whose pair has stopped being near-identical
// fails too, because an exemption that outlives its reason is what the next
// person reads instead of checking.
//
// ## Why this exists
//
// `employee_shifts` was found to duplicate `employee_schedules` on 1 October
// 2026 -- same organization_id, employee_id, location_id, role_label, starts_at,
// ends_at and notes, differing only in their status vocabulary -- by reading the
// migrations while looking for something else. Nothing would have found the next
// one.
//
// ## What counts as a duplicate here
//
// Not "similar". The comparison ignores the columns almost every table has
// (`id`, `organization_id`, `created_at`, `updated_at`, `metadata`) because two
// tables sharing those share nothing meaningful, and then asks whether what is
// left is the same set. A pair is reported when the remaining columns overlap by
// at least the threshold in the script.
//
// ## What an entry is not
//
// It is not permission for the duplication. `employee_shifts` is recorded below
// as a duplicate that exists, with retiring it named as a separate owner
// decision -- because dropping a table is a destructive data change and
// AGENTS.md puts those behind owner approval. The register records the finding so
// the check stays green on a known state; it does not record approval.

const DUPLICATE_TABLE_REVIEWS = Object.freeze([
  Object.freeze({
    tables: Object.freeze(["employee_schedules", "employee_shifts"]),
    verdict: "duplicate_awaiting_owner_decision",
    reason:
      "Same shape and same purpose: both carry employee_id, location_id, role_label, starts_at, ends_at and notes, "
      + "and differ only in their status vocabulary. employee_schedules is the one with a product behind it -- "
      + "/business-builder/owner/schedules writes it and routes/sonara-rota-routes.cjs reads it -- and employee_shifts "
      + "has no reader at all. Migration 20261001120000 deliberately did not give employee_shifts the payroll key its "
      + "siblings got, so nothing new keys to it. Retiring it is a destructive data change and therefore the owner's "
      + "decision; see docs/owner/OWNER-STEPS.md."
  }),
  Object.freeze({
    tables: Object.freeze(["creator_generation_events", "growth_control_events"]),
    verdict: "parallel_by_design",
    reason:
      "The same shape, deliberately, and not the same table. Both are an event log for one product's control plane, so "
      + "they share event_type, event_status, details and job_id by name -- and `job_id` is the reason they are two "
      + "tables rather than one: it references creator_generation_jobs(id) in the first and growth_provider_jobs(id) in "
      + "the second. growth_control_events also carries campaign_id. Merging them would mean one table with two "
      + "mutually exclusive job references and a status vocabulary that is the union of two products', which is worse "
      + "than two tables. Found by this check on 1 October 2026, which is the pair that showed what it compares: column "
      + "names, not the tables they point at."
  })
]);

module.exports = { DUPLICATE_TABLE_REVIEWS };
