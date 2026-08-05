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
// it" -- and not counting a name that only appears in a comment -- it was 90,
// and is 87 after three of them became workspaces in this change.
// scripts/report-orphan-tables.mjs is that measurement, so the number is
// recomputed on every run rather than asserted here.
//
// And "drop them" is the wrong action for most of the list. These fall into
// four kinds and only one is a deletion:
//
//   superseded -- an earlier generation of a table that is live under another
//     name. campaigns/growth_campaigns, billing_customers/stripe_customers.
//     These are the real retirement candidates, and they are the ones that make
//     the schema misleading: open the database, find the table with the obvious
//     name, and it is empty and always will be.
//
//   unbuilt -- a whole subsystem that was designed in SQL and never written.
//     Eighteen github_repository_* tables, eleven entity_*, five
//     business_sub_app_*, nine sonara_*_registry. Dropping these throws away a
//     design; building them invents product nobody asked for. They wait.
//
//   buildable -- an ordinary feature with a real schema, no code, and an
//     obvious place in an existing workspace. Three of these became pages in
//     the same change that added this file, which is why the list is shorter
//     than the audit's.
//
//   system -- written by infrastructure rather than the application: rate
//     limits, audit trails, observability. Absence from application source is
//     expected, not a finding.
//
// Nothing here drops anything. Every entry is a statement about what the table
// is, so that a decision to remove one is made per table with its successor
// named, rather than as a bulk operation against a number nobody could
// reproduce. Whether any of them hold rows cannot be answered from this
// repository; that check belongs against the live project before any drop.

const ORPHAN_DISPOSITIONS = Object.freeze({
  // ---- superseded: live equivalent exists under another name ----
  audit_events: { group: "superseded", decision: "retire", supersededBy: "admin_audit_logs" },
  billing_customers: { group: "superseded", decision: "retire", supersededBy: "stripe_customers" },
  sonara_billing_customers: { group: "superseded", decision: "retire", supersededBy: "stripe_customers" },
  sonara_subscriptions: { group: "superseded", decision: "retire", supersededBy: "billing_subscriptions" },
  contact_records: { group: "superseded", decision: "retire", supersededBy: "customer_records" },
  contact_import_batches: { group: "superseded", decision: "retire", supersededBy: "growth_leads" },
  communication_preferences: { group: "superseded", decision: "retire", supersededBy: "user_preferences" },
  permission_grants: { group: "superseded", decision: "retire", supersededBy: "user_roles" },
  permission_audit_logs: { group: "superseded", decision: "retire", supersededBy: "admin_audit_logs" },
  sonara_permission_matrix: { group: "superseded", decision: "retire", supersededBy: "user_roles" },
  open_source_tools: { group: "superseded", decision: "retire", supersededBy: "data/open-source-tools.ts, rendered at /research-lab/open-source" },
  organization_integrations: { group: "superseded", decision: "retire", supersededBy: "integration_providers" },
  integration_statuses: { group: "superseded", decision: "retire", supersededBy: "integration_jobs" },

  // ---- system: written by infrastructure, not by the application ----
  sonara_auth_rate_limits: { group: "system", decision: "keep", note: "Rate limiting state. Absence from application source is expected." },
  observability_events: { group: "system", decision: "keep", note: "Operational telemetry sink." },
  agent_action_logs: { group: "system", decision: "keep", note: "Audit trail for automated actions." },
  workflow_runs: { group: "system", decision: "keep", note: "Execution history for background work." },

  // ---- buildable: real schema, no code, fits an existing workspace ----
  accounting_exports: { group: "buildable", decision: "build", note: "Belongs beside vendor invoices in the Business Builder owner area." },
  bill_payment_records: { group: "buildable", decision: "build", note: "Payments against vendor invoices. Needs the invoice detail view first." },
  vendor_invoice_lines: { group: "buildable", decision: "build-with-parent", note: "Lines of a vendor invoice. Belongs inside the invoice, not on a page of its own." },
  purchase_order_lines: { group: "buildable", decision: "build-with-parent", note: "Lines of a purchase order, whose page exists at /business-builder/owner/purchase-orders." },
  inventory_count_lines: { group: "buildable", decision: "build-with-parent", note: "Lines of a stock count, whose page exists at /business-builder/owner/stock-counts." },
  location_transfer_lines: { group: "buildable", decision: "build-with-parent", note: "Lines of a transfer, whose page exists at /business-builder/owner/transfers." },
  pos_menu_mix_items: { group: "buildable", decision: "build", note: "Sales mix per menu item. Reporting, not a record workspace." },
  business_vertical_templates: { group: "buildable", decision: "build", note: "Starting templates by trade. Would fit the Business Builder setup flow." },
  service_comments: { group: "buildable", decision: "build", note: "Comments on a service request. Belongs in the request detail view." },
  release_plans: { group: "buildable", decision: "build", note: "Creator Studio release planning, beside creator_assets." },
  song_fingerprints: { group: "buildable", decision: "defer", note: "Anti-clone matching. Needs a designed safety flow before any UI." },
  media_capture_records: { group: "buildable", decision: "defer", note: "Device capture. Gated on the camera and microphone consent design." },
  phone_number_records: { group: "buildable", decision: "defer", note: "Telephony. No provider is connected." },
  route_tracking_points: { group: "buildable", decision: "defer", note: "Location trail. Needs a tracking consent design first." },
  voice_command_logs: { group: "buildable", decision: "defer", note: "Voice. Off by default per AGENTS.md." },
  user_device_permissions: { group: "buildable", decision: "defer", note: "Device permission grants, alongside the capture design." },
  device_capability_profiles: { group: "buildable", decision: "defer", note: "Device capability detection, same design." },
  sonara_sound_sync_runs: { group: "buildable", decision: "defer", note: "Sound sync. Sounds are off by default per AGENTS.md." },
  sonara_module_dependencies: { group: "buildable", decision: "defer", note: "Module graph. Descriptive, no workspace." },

  // ---- unbuilt: a subsystem designed in SQL and never written ----
  ...subsystem("github repository review", [
    "github_repositories", "github_repository_audit_logs", "github_repository_blocklist",
    "github_repository_business_reviews", "github_repository_categories", "github_repository_codex_prompts",
    "github_repository_feature_flags", "github_repository_license_reviews", "github_repository_maintenance_reviews",
    "github_repository_privacy_reviews", "github_repository_product_fit", "github_repository_recommendations",
    "github_repository_reviews", "github_repository_score_history", "github_repository_security_reviews",
    "github_repository_sync_jobs", "github_repository_update_events", "github_repository_watchlist"
  ], "A repository intake and review pipeline. /research-lab/requested-repositories and /research-lab/open-source cover the same ground from data/open-source-tools.ts, which is what actually ships."),

  ...subsystem("entity agent operations", [
    "entity_action_approvals", "entity_action_runs", "entity_agent_memory", "entity_agent_runs",
    "entity_agent_tool_registry", "entity_audit_logs", "entity_automation_runs", "entity_browser_bookmarks",
    "entity_connector_events", "entity_research_notes", "entity_settings"
  ], "An autonomous agent subsystem. Nothing in the product runs agents, and AGENTS.md holds that these systems are not AI and must not claim to be."),

  ...subsystem("sub-app builder", [
    "business_sub_app_database_schemas", "business_sub_app_deployments", "business_sub_app_modules",
    "business_sub_app_pages", "business_sub_apps"
  ], "A builder for customer-generated sub-applications. No code, and it overlaps business_workspaces."),

  ...subsystem("platform registries", [
    "sonara_ecosystem_registry", "sonara_engine_registry", "sonara_module_registry",
    "sonara_realtime_channel_registry", "sonara_storage_bucket_registry", "sonara_ui_capability_registry",
    "sonara_webhook_verification_registry", "sonara_worker_job_registry", "sonara_write_api_registry"
  ], "Registries describing the platform to itself. The application reads its own code and configuration instead, so these have never been populated."),

  ...subsystem("open-source and tool review", [
    "license_reviews", "open_source_adapter_runs", "open_source_software_capabilities",
    "open_source_software_catalog", "provider_registry", "research_sources", "security_reviews", "tool_reviews"
  ], "A database-backed version of the review register. data/open-source-tools.ts holds the reviewed set, scripts/verify-open-source-registry.mjs gates it, and /research-lab/open-source renders it.")
});

// Every subsystem table gets the same group, decision and reason, written once.
function subsystem(name, tables, note) {
  return Object.fromEntries(tables.map((table) => [table, { group: `unbuilt: ${name}`, decision: "await direction", note }]));
}

const ORPHAN_TABLES = Object.freeze(Object.keys(ORPHAN_DISPOSITIONS).sort());

function dispositionFor(table) {
  return ORPHAN_DISPOSITIONS[String(table || "")] || null;
}

function tablesWithDecision(decision) {
  return ORPHAN_TABLES.filter((table) => ORPHAN_DISPOSITIONS[table].decision === decision);
}

module.exports = { ORPHAN_TABLES, ORPHAN_DISPOSITIONS, dispositionFor, tablesWithDecision };
