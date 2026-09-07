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
// **Thirteen names added 6 September 2026, and why they were missing.**
// Deployment #130 failed at "Verify complete production Supabase state" with
// `active application table is missing from production: public.sonara_subscriptions`
// and two more like it. The gate was demanding tables the codebase had
// deliberately dropped on 6 August.
//
// The cause is a parser that silently stopped matching, which is this
// repository's recurring defect exactly. `deriveMigrationState` in
// scripts/verify-production-supabase.mjs builds the expected-table set with
//
//     /create\s+table\s+...public\.(name)|drop\s+table\s+...public\.(name)/
//
// so it removes a table only when a migration names it in a literal `drop
// table` statement. `20260806000000_drop_retired_superseded_tables.sql` drops
// its thirteen through `execute format('drop table ... public.%I', t)` inside a
// loop, and a literal name never appears. The creates were seen; the drops were
// invisible. Three of the thirteen were actually gone from production, so the
// gate failed on those three and treated the other ten as active tables that
// happen to exist.
//
// Adding them here is the correct half: this list is what "production is not
// required to have this table" means. The other half is
// tests/a-dynamic-drop-still-retires-the-table.test.js, which reads that
// migration's own array and fails when a name in it is missing from this list --
// so the next migration that drops through dynamic SQL cannot reopen the gap.
//
// None of the thirteen is queried by runtime code; that was checked before they
// were added, and the reconciliation test below enforces it permanently.
const RETIRED_DATABASE_TABLES = Object.freeze([
  "audio_assets",
  "audit_events",
  "audit_log",
  "billing_customers",
  "bookings",
  "business_profiles",
  "campaigns",
  "communication_preferences",
  "consent_records",
  "contact_import_batches",
  "contact_records",
  "creator_profiles",
  "daw_sessions",
  "employee_job_posts",
  "files",
  "growth_workspaces",
  "integration_statuses",
  "integrations",
  "inventory_movements",
  "leads",
  "legal_acceptances",
  "notification_preferences",
  "open_source_tools",
  "organization_integrations",
  "payments",
  "permission_audit_logs",
  "permission_grants",
  "products",
  "research_snapshots",
  "sonara_billing_customers",
  "sonara_permission_matrix",
  "sonara_subscriptions",
  "sound_analysis_results",
  "vehicle_inspections",
  "vibration_animation_cues",
  "webhook_events"
]);

module.exports = { RETIRED_DATABASE_TABLES };
