"use strict";

// Historical migrations remain immutable and their versions must stay recorded in
// production. These identifiers belong to superseded schemas and are not active
// SONARA runtime tables. The deep verifier excludes only these reviewed names;
// every other table left by the migration chain remains part of the production
// structural contract.
const RETIRED_DATABASE_TABLES = Object.freeze([
  "audio_assets",
  "audit_log",
  "bookings",
  "business_profiles",
  "campaigns",
  "consent_records",
  "creator_profiles",
  "daw_sessions",
  "employee_announcements",
  "employee_job_posts",
  "employee_tasks",
  "files",
  "growth_workspaces",
  "integrations",
  "inventory_movements",
  "leads",
  "legal_acceptances",
  "notification_preferences",
  "payments",
  "products",
  "quotes",
  "research_snapshots",
  "reviews",
  "sound_analysis_results",
  "vehicle_inspections",
  "vibration_animation_cues",
  "webhook_events"
]);

module.exports = { RETIRED_DATABASE_TABLES };
