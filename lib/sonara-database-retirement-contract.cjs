"use strict";

// Historical migrations remain immutable and their versions must stay recorded in
// production. These identifiers belong to superseded schemas and are not active
// SONARA runtime tables. The deep verifier excludes only these reviewed names;
// every other table left by the migration chain remains part of the production
// structural contract.
//
// **Being on this list means production is not required to have the table.**
// scripts/verify-production-supabase.mjs drops these from `expectedTables` and
// verifies them with `required: false`, so an absent one is not a failure -- and
// it emits a warning saying the table "should be reviewed for archival".
//
// Four names were on it that live customer-facing code queries, found 18 August
// 2026 by checking the list against the runtime rather than reading it:
//
//   employee_announcements  /staff/announcements
//   employee_tasks          /staff/tasks
//   quotes                  /business-builder/owner/quotes and its API
//   reviews                 the "Reviewed" stage of the customer journey
//
// So the production gate did not require four tables four surfaces depend on,
// and advised archiving them. That is the shape this repository keeps finding:
// an exclusion list whose reasons expired, still being read as current.
//
// tests/supabase-active-contract-reconciliation.test.js now refuses any entry
// here that runtime code queries, so the list cannot outlive its reasons again.
const RETIRED_DATABASE_TABLES = Object.freeze([
  "audio_assets",
  "audit_log",
  "bookings",
  "business_profiles",
  "campaigns",
  "consent_records",
  "creator_profiles",
  "daw_sessions",
  "employee_job_posts",
  "files",
  "growth_workspaces",
  "integrations",
  "inventory_movements",
  "leads",
  "legal_acceptances",
  "notification_preferences",
  "payments",
  "products",
  "research_snapshots",
  "sound_analysis_results",
  "vehicle_inspections",
  "vibration_animation_cues",
  "webhook_events"
]);

module.exports = { RETIRED_DATABASE_TABLES };
