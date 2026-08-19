"use strict";

// The subsystems that exist as schema and had no code.
//
// lib/sonara-orphan-tables.cjs classified 87 tables the application never
// queried. Fifty-one of them were not strays -- they are five coherent
// subsystems, designed in SQL, given row level security and indexes, and never
// written. Dropping them throws away a design. Inventing write flows for them
// invents product nobody specified.
//
// So this makes them readable and nothing else. Every page here lists what is
// actually in the table, for an operator, with no way to create, edit or delete
// anything. That is the honest state of these subsystems: the data model was
// decided, the behaviour was not, and a page that pretends otherwise would be
// the same failure as the placeholder workspaces that said a feature "unlocks
// after billing state confirms plan access" while doing nothing.
//
// Two constraints shaped this.
//
// Seven of the eleven entity_* tables are in
// DATABASE_TABLE_GROUPS.agentsAndAutomation, and
// scripts/verify-supabase-contract.mjs asserts on every release that the agent
// foundation is "schema-only and approval-gated" with "autonomous execution
// remains disabled". Read-only pages keep that guarantee exactly as it stands.
// Giving these tables a way to write would break a gated promise and contradict
// the standing rule that these systems are not AI and must not claim to be.
//
// The other four are not in the canonical contract at all, so the gate does not
// reach them. The page says which is which. A test caught that -- the first
// version of this file grouped all eleven as gated, which claimed a guarantee
// four of them never had.
//
// Columns are not listed by hand. They are read from supabase/migrations/ by
// lib/sonara-migration-columns.cjs, minus anything whose name suggests a secret
// or a raw payload. Fifty-one hand-written column lists would drift from the
// schema the first time anybody altered a table, and a column list that has
// drifted renders "Not recorded" forever while looking like missing data.

const { tableColumns, describedColumns } = require("./sonara-migration-columns.cjs");

// Which of these tables may be written to by hand, and which may only be read.
//
// The line is not "is it safe" -- they are all admin-only. It is whether a
// hand-entered row would be a statement of intent or a fabricated fact.
//
// A registry, a catalog, a watchlist, a blocklist, a review, a note, a setting:
// somebody deciding something, and typing it in is how the decision gets
// recorded. Those are writable.
//
// A run, an event, a log, a job, a deployment, a memory, an approval: a record
// that something happened. Typing one in by hand does not make it have
// happened; it puts a fabricated row beside the real ones with nothing to tell
// them apart. This is the same call made for growth_touchpoints in
// lib/sonara-growth-create-specs.cjs, and for the same reason -- these rows are
// evidence, and a form for evidence is a form for inventing it.
//
// entity_action_approvals is on the read-only side deliberately, and it is the
// one worth explaining. An approval is a human decision, which by the rule above
// would make it writable. But it approves an action run, and nothing in this
// product executes actions -- so a hand-written approval would approve something
// that does not exist and cannot happen. When execution is built, the approval
// belongs in that flow rather than on a generic form.
const RECORDS_A_FACT = /_(runs|events|logs|jobs|history|deployments|memory|approvals)$/;

function isWritable(table) {
  return !RECORDS_A_FACT.test(String(table || ""));
}

// Never rendered, whatever table they appear on. Credentials, tokens, raw
// provider payloads and anything that could carry a customer's own text back
// out through an operator screen.
const WITHHELD_COLUMN = /(password|secret|token|api[_-]?key|credential|service[_-]?role|signature|private[_-]?key|encrypted|payload|raw_|_raw|response_body|request_body)/i;

// Shown last and only when present -- they are the same on every table and say
// nothing about what the record is.
const TRAILING_COLUMNS = ["created_at", "updated_at"];

// Identifiers. Present on everything, useful to nobody reading a page.
const HIDDEN_COLUMNS = new Set(["id", "organization_id", "user_id", "platform_id", "tenant_id"]);

const SUBSYSTEMS = Object.freeze([
  {
    slug: "repository-review",
    title: "Repository review",
    heading: "Repository review pipeline",
    body: "A schema for reviewing external repositories before use: licence, security, privacy and maintenance checks, scoring, and a blocklist. The review register that actually ships is data/open-source-tools.ts, rendered at /research-lab/open-source.",
    status: "Designed, never built. Nothing writes to these tables.",
    tables: [
      "github_repositories", "github_repository_audit_logs", "github_repository_blocklist",
      "github_repository_business_reviews", "github_repository_categories", "github_repository_codex_prompts",
      "github_repository_feature_flags", "github_repository_license_reviews", "github_repository_maintenance_reviews",
      "github_repository_privacy_reviews", "github_repository_product_fit", "github_repository_recommendations",
      "github_repository_reviews", "github_repository_score_history", "github_repository_security_reviews",
      "github_repository_sync_jobs", "github_repository_update_events", "github_repository_watchlist"
    ]
  },
  {
    slug: "agent-foundation",
    title: "Agent foundation",
    heading: "Agent foundation (execution disabled)",
    body: "A schema for agent runs, memory, tool registration, approvals and connector events. None of it runs. scripts/verify-supabase-contract.mjs asserts on every release that this foundation stays schema-only and approval-gated, with autonomous execution disabled.",
    // Said plainly on the page, not only here. Somebody looking at nineteen
    // agent tables is entitled to know whether anything is running.
    status: "Deliberately inert. These pages read; nothing in this product executes agents.",
    // Seven of these eleven are in DATABASE_TABLE_GROUPS.agentsAndAutomation,
    // which scripts/verify-supabase-contract.mjs checks on every release. Four
    // are not in the canonical contract at all, so that guarantee does not
    // reach them -- and the page says which is which rather than implying the
    // gate covers everything on it.
    //
    // Splitting them was not the first instinct. Adding the four to the gated
    // group would have been tidier to read and would have broken the canonical
    // count the contract asserts, so the honest option was to narrow the claim
    // rather than widen the promise.
    gatedTables: [
      "entity_action_approvals", "entity_action_runs", "entity_agent_memory", "entity_agent_runs",
      "entity_agent_tool_registry", "entity_automation_runs", "entity_connector_events"
    ],
    ungatedTables: ["entity_audit_logs", "entity_browser_bookmarks", "entity_research_notes", "entity_settings"],
    ungatedNote: "Outside the canonical database contract, so the release gate that keeps agent execution disabled does not cover these four. Nothing reads or writes them either; they are here for completeness.",
    tables: [
      "entity_action_approvals", "entity_action_runs", "entity_agent_memory", "entity_agent_runs",
      "entity_agent_tool_registry", "entity_audit_logs", "entity_automation_runs", "entity_browser_bookmarks",
      "entity_connector_events", "entity_research_notes", "entity_settings"
    ]
  },
  {
    slug: "platform-registries",
    title: "Platform registries",
    heading: "Platform registries",
    body: "Tables describing the platform to itself — engines, modules, storage buckets, realtime channels, worker jobs, write APIs. The application reads its own code and configuration instead, so none of these has ever been populated.",
    status: "Superseded in practice by reading the code. Kept because the shape is a useful record of intent.",
    tables: [
      "sonara_ecosystem_registry", "sonara_engine_registry", "sonara_module_registry",
      "sonara_realtime_channel_registry", "sonara_storage_bucket_registry", "sonara_ui_capability_registry",
      "sonara_webhook_verification_registry", "sonara_worker_job_registry", "sonara_write_api_registry"
    ]
  },
  {
    slug: "tool-review",
    title: "Tool and licence review",
    heading: "Tool and licence review",
    body: "A database-backed version of the open-source review register: catalogued software, capabilities, licence and security reviews, adapter runs and research sources.",
    status: "Superseded by data/open-source-tools.ts, which is gated on every release and rendered at /research-lab/open-source.",
    // integration_statuses is here because it holds 23 live refusals -- which
    // integrations are blocked, quarantined or developer-only, and why. It was
    // classified as superseded and retired by mistake; the drop migration's row
    // count refused it and 20260806090000 brought it back. It is a policy
    // register, not the work queue integration_jobs is.
    tables: [
      "integration_statuses",
      "license_reviews", "open_source_adapter_runs", "open_source_software_capabilities",
      "open_source_software_catalog", "provider_registry", "research_sources", "security_reviews", "tool_reviews"
    ]
  },
  {
    slug: "device-and-consent",
    title: "Device, location and voice",
    heading: "Device, location and voice records",
    body: "What a customer's device can do, what it was allowed to do, and what it captured — camera and microphone records, location trails, and voice commands.",
    // Every one of these is off by default and stays off. AGENTS.md holds that
    // sounds, voice announcements, haptics and alerts are off or explicitly
    // user-controlled, and a location trail or a microphone capture needs a
    // consent flow that does not exist yet. Listing them makes the design
    // visible; it does not switch anything on, and nothing here captures
    // anything.
    status: "Nothing captures, tracks or listens. These tables record what a consent flow would write, and that flow has not been designed.",
    tables: [
      "device_capability_profiles", "user_device_permissions", "media_capture_records",
      "route_tracking_points", "voice_command_logs", "sonara_sound_sync_runs", "phone_number_records"
    ]
  },
  {
    slug: "creative-safety",
    title: "Creative safety and release planning",
    heading: "Creative safety and release planning",
    // "Fingerprints used to tell one piece of work from another" is what this
    // said, and it is what an acoustic fingerprint does -- so anybody reading
    // it alongside the table's name would take song_fingerprints for a store of
    // values derived from recordings. It holds none. Its columns are
    // song_title, creator_name, identity, mood, audience_signal and
    // sonic_palette, and fingerprint_id is a plain text field somebody supplies:
    // a description of a work's creative identity, with no audio and nothing
    // derived from any. A name promising a capability the columns do not have
    // is the defect CLAUDE.md describes, sitting in a description rather than
    // in code, which is where it is hardest to notice.
    //
    // The table cannot be renamed from here -- migration 004 is frozen and a
    // rename is a destructive data change, which AGENTS.md puts behind owner
    // approval. So the description is made to match the columns instead.
    body: "A written description of each work -- its title, who made it, its mood and sonic palette -- and the release plans that hang off them.",
    status: "song_fingerprints holds descriptions, not audio: nothing is derived from a recording and nothing compares two of them. Acoustic matching would be new storage and a new safety flow, and the flow has to be designed before anything acts on a match. Nothing matches or blocks today.",
    tables: ["song_fingerprints", "release_plans"]
  },
  {
    slug: "operational-records",
    title: "Operational records",
    heading: "What the system recorded about itself",
    body: "Rate limits, telemetry, automated actions and background work, as the infrastructure wrote them.",
    // All four are written by infrastructure rather than the application, which
    // is why they never appeared in application source. Every one records that
    // something happened, so every one is read-only by the rule below.
    status: "Written by infrastructure, not by anybody using the product. All read-only: these are records of things that happened.",
    tables: ["agent_action_logs", "observability_events", "sonara_auth_rate_limits", "workflow_runs"]
  },
  {
    slug: "business-reference",
    title: "Business reference data",
    heading: "Reference data",
    body: "Starting templates by trade, the module dependency graph, and sales mix by menu item.",
    status: "Reference and reporting. business_vertical_templates got its rows and a page on 19 August 2026 -- /business-builder/templates renders eight starting points by trade, and every path in every row is checked against the route registry. sonara_module_dependencies and pos_menu_mix_items are still reporting only.",
    tables: ["business_vertical_templates", "sonara_module_dependencies", "pos_menu_mix_items"]
  },
  {
    slug: "sub-app-builder",
    title: "Sub-app builder",
    heading: "Sub-app builder",
    body: "A schema for customer-generated sub-applications: their pages, modules, database schemas and deployments.",
    status: "Designed, never built. Overlaps business_workspaces, which is what customers actually get.",
    tables: [
      "business_sub_app_database_schemas", "business_sub_app_deployments", "business_sub_app_modules",
      "business_sub_app_pages", "business_sub_apps"
    ]
  }
]);

// The columns worth showing for a table, read from the migrations rather than
// listed here. Returns [] for a table the reader cannot find, so a caller can
// say so rather than rendering an empty table that looks like no records.
function displayColumns(table, limit = 7) {
  const columns = tableColumns(table);
  if (!columns) return [];
  const all = [...columns];
  const body = all.filter((column) => !HIDDEN_COLUMNS.has(column) && !TRAILING_COLUMNS.includes(column) && !WITHHELD_COLUMN.test(column));
  const trailing = TRAILING_COLUMNS.filter((column) => columns.has(column));
  return [...body.slice(0, Math.max(1, limit - trailing.length)), ...trailing];
}

// What PostgREST is asked for. Always includes id so a row can be identified in
// a support conversation, even though it is not rendered.
function selectFor(table) {
  const columns = displayColumns(table);
  if (!columns.length) return "";
  const withId = tableColumns(table)?.has("id") ? ["id", ...columns] : columns;
  return withId.join(",");
}

// A form built from the schema: the columns a person may set, with the type and
// the allowed values the database will accept. Nothing here is hand-listed, so
// a column that changes shape changes the form with it.
//
// Left out: anything the database fills in (id, created_at), anything scoped by
// the server (organization_id, user_id), anything named like a secret, and json
// columns -- a textarea expecting valid jsonb is a trap rather than a field.
function formFields(table) {
  if (!isWritable(table)) return [];
  return describedColumns(table)
    .filter((column) => !column.generated)
    .filter((column) => !HIDDEN_COLUMNS.has(column.name))
    .filter((column) => !WITHHELD_COLUMN.test(column.name))
    .filter((column) => column.type !== "json")
    .map((column) => ({
      name: column.name,
      label: columnLabel(column.name),
      type: column.allowed.length ? "choice" : column.type,
      required: column.required,
      values: column.allowed,
      fallback: column.fallback
    }));
}

function subsystemFor(slug) {
  return SUBSYSTEMS.find((subsystem) => subsystem.slug === String(slug || "")) || null;
}

function allSubsystemTables() {
  return SUBSYSTEMS.flatMap((subsystem) => subsystem.tables);
}

// A column name turned into something readable. No dictionary: these are
// operator screens and the column name is the most accurate label available.
function columnLabel(column) {
  return String(column || "").replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase());
}

function cellText(value) {
  if (value === null || value === undefined || value === "") return "Not recorded";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") {
    // A jsonb column. Show that something is there and how much, rather than
    // pasting a blob into a table cell.
    const keys = Array.isArray(value) ? value.length : Object.keys(value).length;
    if (!keys) return "Empty";
    return Array.isArray(value) ? `${keys} item${keys === 1 ? "" : "s"}` : `${keys} field${keys === 1 ? "" : "s"}`;
  }
  const text = String(value);
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

module.exports = {
  SUBSYSTEMS,
  RECORDS_A_FACT,
  formFields,
  isWritable,
  WITHHELD_COLUMN,
  allSubsystemTables,
  cellText,
  columnLabel,
  displayColumns,
  selectFor,
  subsystemFor
};
