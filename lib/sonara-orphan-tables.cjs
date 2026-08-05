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
// It is 36: three became Business Builder workspaces, and 51 became readable at
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

  // The five subsystems that were here -- 51 tables across repository review,
  // the agent foundation, platform registries, tool review and the sub-app
  // builder -- are no longer orphaned. /research-lab/subsystems reads every one
  // of them, so they are queried and scripts/report-orphan-tables.mjs stops
  // counting them. lib/sonara-subsystem-registry.cjs describes them now.
  //
  // The gate is what noticed. Building those pages made 51 entries here stale
  // in one go, and --check failed until they were removed, which is the half of
  // the check that stops this list from outliving the problem it describes.
});

const ORPHAN_TABLES = Object.freeze(Object.keys(ORPHAN_DISPOSITIONS).sort());

function dispositionFor(table) {
  return ORPHAN_DISPOSITIONS[String(table || "")] || null;
}

function tablesWithDecision(decision) {
  return ORPHAN_TABLES.filter((table) => ORPHAN_DISPOSITIONS[table].decision === decision);
}

module.exports = { ORPHAN_TABLES, ORPHAN_DISPOSITIONS, dispositionFor, tablesWithDecision };
