import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { runtimeSourceFiles, blindnessReason } = require("../lib/sonara-runtime-source-files.cjs");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDirectory = path.join(root, "supabase", "migrations");
const contractMigrationName = "20260722170000_complete_ecosystem_database_contract.sql";
const referenceContractExtensionName = "20260722201600_extend_database_contract_reference_intelligence.sql";
const productLifecycleMigrationName = "20260723193000_product_lifecycle_system.sql";
const marketIntelligenceMigrationName = "20260725120000_market_intelligence_system.sql";
const promptLibraryMigrationName = "20260726163000_sonara_prompt_library.sql";
const promptLibrarySecurityMigrationName = "20260726194500_prompt_library_production_boundaries.sql";
// The usage ledger, added 10 September 2026. The frozen contract migration of
// 22 July cannot be edited -- its checksum is pinned -- so a table introduced
// later carries its own runtime assertions and is named here, which is the same
// pattern the reference-intelligence extension established.
const usageLedgerMigrationName = "20260910020000_usage_credit_ledger.sql";
// The business management passcode, added 1 October 2026. Same reason as the
// ledger above: the frozen contract migration cannot be edited, so a table
// introduced later is named here and carries its own assertions.
const managementCredentialMigrationName = "20261001150000_a_business_owner_gets_a_second_thing_to_know.sql";
// Work that comes round again. Named here because the per-table loop below
// requires every canonical table to be checked by a contract-bearing migration,
// and this one carries its own assertion block: the table, RLS on with no
// policy, the service-role grants, no DELETE, a non-nullable organization and a
// cadence constraint.
const recurringTaskMigrationName = "20261001160000_work_that_comes_round_again.sql";
const operationalIndexMigrationName = "20260718193000_operational_query_index_contract.sql";
const businessControlMigrationNames = [
  "20260723060000_business_builder_control_plane.sql",
  "20260723060500_business_integration_connections.sql"
];
const creatorProjectMigrationNames = ["20261002090000_creator_project_graph.sql", "20261002075825_included_generation_periods.sql"];
const CREATOR_PROJECT_TABLES = Object.freeze(["creator_projects", "generation_usage_reservations"]);
const creatorGenerationMigrationNames = [
  "20260723080000_creator_generation_control_plane.sql"
];
const creatorArtistSystemMigrationNames = [
  "016_creator_artist_system_schema.sql",
  "20260819080000_public_creator_profiles_and_follows.sql"
];
// The operations group spans five migrations rather than one, because it grew
// as the workspaces did. Named individually rather than checked against every
// migration at once: "some file somewhere creates this" is a weaker statement
// than "these files do", and the weaker one passes even when a table has
// quietly moved out of the subsystem it is listed under.
// The approval queue, added 13 August 2026. Reviewed rather than canonical for
// the same reason as the rest of these: the canonical 145 are pinned by the
// runtime contract migration, and this table postdates it.
const agentQueueMigrationNames = [
  "20260813120000_agent_pending_actions.sql",
  "20260813180000_agent_schedules.sql"
];
// Tool permissions, added 1 October 2026. Its own list rather than folded into
// the queue's: the queue holds a refused action's inputs so an approval has
// something to re-run, and a permission table has nothing to do with that.
const agentToolPermissionMigrationNames = [
  "20261001190000_tool_permissions_on_the_tenant_that_runs_them.sql"
];
// The Creator Studio project graph, added 2 October 2026. Its own list rather
// than appended to creatorArtistSystemMigrationNames: that list is migration
// 016's subtree, whose head nothing writes, and these three tables hang off
// creator_assets, which routes/sonara-asset-file-routes.cjs genuinely writes.
const creatorProjectGraphMigrationNames = [
  "20261002010000_creator_approval_graph.sql"
];
// Venues, events and RSVPs, added 2 October 2026. Its own list rather than folded
// into growthStudioMigrationNames: that group is the campaign and lead control
// plane, and an event is not a campaign -- nothing here sends anything, which is
// the distinction the assertions below are written to keep.
const growthEventMigrationNames = [
  "20261002060000_public_events_and_rsvps.sql"
];
// The shop and the orders placed on it, added 2 October 2026. Its own list rather
// than folded into businessOperationsMigrationNames: that group is the back office,
// and this is a public front door with its own rule about what a zero price means.
// Stock that moves with orders and jobs: the ledger and its two locked functions.
const inventoryStockMigrationNames = [
  "20261006040000_stock_holds_with_orders_and_jobs.sql"
];
const merchantStoreMigrationNames = [
  "20261002120000_a_storefront_a_stranger_can_buy_from.sql",
  // Payment on the shop's connected account, and the insert-only payment events.
  "20261006020000_a_storefront_order_is_paid_on_the_shops_own_account.sql"
];
const businessOperationsMigrationNames = [
  "010_sonara_platform_current_schema.sql",
  "013_sonara_business_employee_music_ops_schema.sql",
  "014_sonara_restaurant_margin_ops_schema.sql",
  "015_sonara_device_sensory_location_schema.sql",
  "20260811220000_customer_invoices_accounts_receivable.sql",
  "20260811234500_customer_invoice_lines.sql",
  "20260818100000_merchant_product_catalogue.sql",
  "20260819070000_shared_links.sql",
  "20260820060000_public_booking_pages.sql",
  "20260820080000_recurring_invoices.sql",
  "20260923020000_business_work_order_job_lifecycle.sql"
];
const growthStudioMigrationNames = [
  "20260723120000_growth_studio_control_plane.sql",
  // Defining a good customer, capturing one, scoring it, and giving it to
  // somebody. growth_leads itself is canonical and predates all of this; these
  // four are what turns a stranger into a row in it.
  "20260825070000_lead_capture_scoring_and_routing.sql",
  // Who a campaign send reached, per recipient. Listed here because this check
  // is two-sided: declaring a table in GROWTH_STUDIO_TABLES is not enough, and
  // the migration that creates it and enables RLS on it has to be named too.
  "20260916040000_growth_campaign_send_records.sql",
  // What a campaign cost, as the owner recorded it, so its return can be worked
  // out. Append-only like the send records above it.
  "20261007090000_what_a_campaign_cost.sql",
  // What the email provider reported after accepting a campaign message.
  // Append-only, keyed on the provider's event id.
  "20261007130000_what_happened_to_a_campaign_email.sql"
];
const scrollSiteMigrationNames = ["20260826020000_cinematic_scroll_sites.sql"];
// Connected payment accounts, added 26 August 2026 -- one connected Stripe
// account per organization, so a business can be paid by its own customers.
// Reviewed rather than canonical for the same reason as everything else in
// this list: the canonical 145 are pinned by the runtime contract migration
// and this table postdates it.
const connectedPaymentMigrationNames = ["20260826090000_business_payment_accounts.sql"];
// Browsers that granted notification permission, added 26 August 2026. Holds
// the endpoint and two keys the Push API provides and nothing about a person.
// Reviewed rather than canonical: the canonical 145 are pinned by the runtime
// contract migration and this table postdates it.
const pushSubscriptionMigrationNames = ["20260826100000_push_subscriptions.sql"];
// Browser-to-browser calls, added 27 August 2026. Two tables: one call, and the
// offers, answers and ICE candidates in transit between its two ends. The audio
// is peer to peer and never reaches this application, so neither table holds
// any. Reviewed rather than canonical: the canonical 145 are pinned by the
// runtime contract migration and these postdate it.
const callMigrationNames = ["20260827090000_call_sessions.sql"];
// Who changed which owner record and when, added 1 September 2026. Arrived on
// the day the owner record pages first gained a way to change a record at all:
// before that there was nothing to log. Holds the names of the columns that
// changed and no values, because these records carry contact details and a
// second copy of them would be a second place erasure has to reach. Reviewed
// rather than canonical: the canonical 145 are pinned by the runtime contract
// migration and this table postdates it.
const recordChangeLogMigrationNames = ["20260901090000_record_change_log.sql"];
// A second factor, added 1 September 2026. Three tables: the enrolled factor,
// the recovery codes, and the sign-in held back until a code proves who is
// asking. Nothing in any of them is stored in the clear -- the TOTP secret and
// the parked session are sealed under an environment key, the recovery codes
// are peppered hashes, and the challenge id is stored as a digest. Reviewed
// rather than canonical: the canonical 145 are pinned by the runtime contract
// migration and these postdate it.
const twoFactorMigrationNames = ["20260901120000_two_factor_authentication.sql"];
// Durable event delivery, sanitised LLM observations and golden-dataset agent
// evaluations are reviewed operational extensions. They postdate the frozen
// canonical inventory and do not by themselves enable a broker or worker.
const durableEventFoundationMigrationNames = [
  "20260917090000_durable_event_outbox_and_ai_evaluation_store.sql",
  "20260917200000_event_consumer_activation_readiness.sql",
  "20260926025411_durable_worker_contract.sql"
];
const translationFoundationMigrationNames = [
  "20260926025412_translation_records_and_glossary.sql",
  "20260926025656_translation_policy_and_index_hardening.sql",
  "20260926033255_translation_authenticated_read_only.sql",
  "20260926033557_translation_data_api_grants.sql"
];
const researchIntakeMigrationNames = [
  "20260528071500_sonara_platform_redesign_schema.sql",
  "20260819020000_research_source_permission_values.sql"
];
// Three tables the migrations had always created and nothing had ever queried.
// They are reviewed rather than canonical for the same reason as the rest of
// this list: the workspaces at /business-builder/owner/purchase-orders,
// /stock-counts and /transfers read and write them, but they sit outside the
// 145-table canonical contract that predates those pages.
const BUSINESS_OPERATIONS_TABLES = Object.freeze([
  // The task list /staff/tasks serves, and what business_recurring_tasks issues
  // occurrences into. Added 1 October 2026, and it had been queried by the
  // runtime since long before that: routes/sonara-last9-routes.cjs reads it as
  // `supabaseList(config, "employee_tasks", ...)`, and the runtime scan near the
  // bottom of this file matches a table named at the point of use or through a
  // `*_TABLE` constant -- not one passed as a helper's second argument. So this
  // table was queried in production and checked by nothing, and what surfaced it
  // was an unrelated module happening to declare the name as a constant.
  //
  // Four more tables are in that same state right now: business_vertical_templates,
  // employee_announcements, location_events and motion_sensor_events. They are
  // not added here because they belong to different extension sets and each needs
  // its creating migration named; that is its own change rather than a rider on
  // this one.
  "employee_tasks",
  "purchase_orders",
  "inventory_count_sessions",
  "location_transfers",
  "bill_payment_records",
  "accounting_exports",
  // Accounts receivable. Every other money table in this product records what
  // the business owes; these three record who it bills and what it is owed,
  // which for a trades business is the side that decides whether payroll
  // clears.
  "customers",
  "customer_invoices",
  "customer_invoice_payments",
  "customer_invoice_lines",
  // quotes had a table, row level security and no page. It is the record the
  // receivable starts from, and customer_invoices.quote_id points back at it.
  "quotes",
  // What a customer has chosen to publish, across every shareable kind. It is
  // not itself a business record -- it names one, plus the organization that
  // owns it -- and it is what /shared/:token resolves a token through before it
  // reads anything else.
  "shared_links",
  // The address a business publishes for taking appointments, and the hours and
  // window a stranger's booking is worked out from. One row per organization,
  // never public until its owner ticks the box, and read by /book/:slug -- which
  // resolves the organization through it before it reads anything else, the
  // same way /shared/:token resolves through shared_links.
  "public_booking_pages",
  // A standing arrangement and the things it bills for. Two tables rather than
  // one because an amount on the parent would have to be kept in step with
  // lines that can be edited; lib/sonara-recurring-invoices.cjs totals from the
  // lines, so a disagreement between them is impossible rather than unlikely.
  "recurring_invoices",
  "recurring_invoice_lines",
  // Seven more the runtime reads and this contract had never named. They were
  // invisible because the scan below read server.js and routes/ and not lib/,
  // where the record pages, the record checks and the labour costing live.
  //
  // Six are the detail rows under records already in this list -- what is on a
  // purchase order, a stock count, a transfer, a vendor invoice; what each menu
  // item sold; what an employee is paid on a given date. The seventh, reviews,
  // is read by the proof surfaces. All seven are created with row level
  // security by migrations 010, 013 and 014, which verifyExtension now proves
  // rather than this list asserting it.
  "purchase_order_lines",
  "inventory_count_lines",
  "location_transfer_lines",
  "vendor_invoice_lines",
  "pos_menu_mix_items",
  "employee_wage_rates",
  "reviews",
  // Selling something that is not a service. Every table above prices work or
  // tracks stock; neither models a thing sold in sizes at different prices.
  // The versions table is the child of the product, on the same footing as the
  // six line tables above it.
  "merchant_products",
  "merchant_product_variants",
  // Existing fleet route sessions are now linked from work orders. Migration
  // 015 creates the table and enables RLS; keeping it in the reviewed
  // operations set makes that relationship explicit without rewriting the
  // frozen canonical 148-table contract.
  "route_tracking_sessions",
  // Canonical job execution between an accepted quote/booking and an invoice.
  // These postdate the frozen 148-table runtime contract, so they are reviewed
  // through their own migration rather than rewriting historical checksums.
  "business_work_orders",
  "business_work_order_assignments",
  "business_work_order_materials",
  "business_work_order_evidence",
  "business_work_order_events"
]);
const BUSINESS_CONTROL_TABLES = Object.freeze([
  "business_channels",
  "business_permission_grants",
  "business_ownership_transfers",
  "business_control_audit_events",
  "business_integration_connections"
]);
const CREATOR_GENERATION_TABLES = Object.freeze([
  "creator_voice_consents",
  "creator_generation_jobs",
  "creator_generation_assets",
  "creator_reference_analyses",
  "creator_generation_events"
]);
// Migration 016's artist system. Reviewed rather than canonical, the same way
// the operations tables are: the migration predates the 145-table canonical
// contract, and the pages that read and write these -- /creator-studio/artists
// and the four beside it -- were built afterwards.
//
// Five of them had no code at all until then. The sixth and seventh,
// creator_tracks and creator_release_tasks, were never orphaned but were also
// never in this contract, because the only code naming them is
// lib/sonara-record-checks.cjs and the runtime scan below read server.js and
// routes/ only. Widening that scan to lib/ is what surfaced them.
const CREATOR_ARTIST_SYSTEM_TABLES = Object.freeze([
  "creator_artist_profiles",
  // Who asked to hear about which published creator profile. The only table in
  // this list with no organization_id, and deliberately so -- a follow is an
  // edge between a person and somebody else's published profile, and it crosses
  // the tenant boundary by design. Migration 20260819080000 says so at length.
  "creator_follows",
  "creator_sonic_profiles",
  "creator_album_cycles",
  "creator_tracks",
  "creator_prompt_blueprints",
  "creator_video_treatments",
  "creator_release_tasks"
]);
// Two tables, here rather than in agentsAndAutomation because that group is
// canonical and canonical membership is pinned by a migration these postdate.
// What agent_pending_actions holds is the thing that was missing: a gated
// action's own inputs, so an approval has something to re-run.
// agent_schedules joined it in August and can start work but cannot approve it.
//
// It read "One table" until 1 October 2026, having held two since
// 20260813180000_agent_schedules.sql. A small untruth, and the kind this
// repository treats as worth fixing on its own rather than inside a change about
// something else: a count in a comment is what the next reader believes instead
// of counting.
const AGENT_QUEUE_TABLES = Object.freeze(["agent_pending_actions", "agent_schedules"]);
// Which tools an organization permits its agents to use. A separate group from
// the queue above because the queue's comment describes what the queue is for,
// and a permission table filed under it would make that comment describe
// something it does not.
//
// Organization-scoped, and that is the whole reason it exists rather than
// entity_agent_tool_registry being wired up: that table has `enabled` and
// `requires_approval` columns and looks like the answer, but it keys on
// entity_id and public.entities has no organization_id, so reading it to
// authorise an organization's run would be a cross-tenant authorization read.
const AGENT_TOOL_PERMISSION_TABLES = Object.freeze(["agent_tool_permissions"]);
// Brief -> asset -> version -> approval. A separate group from
// CREATOR_ARTIST_SYSTEM_TABLES above because that group's comment describes
// migration 016, and these are not in it.
//
// The one column worth naming here is creator_asset_versions.ai_disclosure. It is
// nullable on purpose, and the assertions below fail if a later migration makes it
// NOT NULL DEFAULT false: that would turn "nobody has answered yet" into "this is
// not AI-generated", which is a provenance claim the schema would be making on a
// creator's behalf. AGENTS.md requires provenance and consent safety, and the
// three-state rule in CLAUDE.md is exactly this case.
// A place, a thing happening there, and who said they are coming.
//
// A separate group from GROWTH_STUDIO_TABLES because that one is the campaign and
// lead control plane. The reason worth stating: nothing in these three sends
// anything. An event page is the organization's own content; a campaign send is
// an owner-approval category in AGENTS.md, and keeping them in different groups
// means the next person wiring a notification has to notice which side they are on.
// The public shop, and what people ordered from it.
//
// Separate from BUSINESS_OPERATIONS_TABLES because that group is the back office.
// The distinction worth stating: an order carries no card and no card token. Since
// 20261006020000 it carries Stripe identifiers and Stripe's own figures, because
// the money is taken by Checkout on the shop's connected account (governed by
// business_payment_accounts); merchant_order_payment_events is the insert-only
// record of what Stripe said.
const MERCHANT_STORE_TABLES = Object.freeze([
  "merchant_storefronts",
  "merchant_orders",
  "merchant_order_lines",
  "merchant_order_payment_events"
]);
// The stock ledger. Its own group: rows are written only by
// inventory_order_hold, inventory_material_stock and the trigger that settles a
// hold when transition_merchant_order fulfils or cancels its order, all under the
// item row locks fulfilment takes -- the guarantee that two buyers cannot both
// take the last item, proven by the two-session race in verify-migration-replay.mjs.
const INVENTORY_STOCK_TABLES = Object.freeze(["inventory_reservations"]);
const GROWTH_EVENT_TABLES = Object.freeze([
  "growth_venues",
  "growth_events",
  "growth_event_rsvps"
]);
const CREATOR_APPROVAL_GRAPH_TABLES = Object.freeze([
  "creator_briefs",
  "creator_asset_versions",
  "creator_asset_approvals"
]);

// One person's decisions about their own device. Its own group because it is the
// only table here keyed on a person with no organization_id at all: a camera
// decision belongs to whoever made it and not to a workspace they happen to be
// in. Three states live in the row count rather than in a column -- no row means
// nobody has been asked -- so there is deliberately no boolean to contract for.
const DEVICE_PERMISSION_TABLES = Object.freeze(["device_permission_grants"]);

// Creator Studio's marketplace. One table, pointing at a version rather than an
// asset so a buyer gets the thing they heard. lib/sonara-creator-marketplace.cjs
// composes the approval graph's publishReadiness rather than restating it:
// selling is never easier than publishing.
// Two tables: the creator's own listing (tenant data, every read scoped), and the
// public catalogue (no organization, exactly the columns a buyer may see -- its
// migration asserts the set). Public pages read only the second.
const CREATOR_MARKETPLACE_TABLES = Object.freeze(["creator_listings", "creator_marketplace_entries"]);
const GROWTH_CHANNEL_TABLES = Object.freeze(["growth_channels", "growth_channel_posts", "growth_post_reports", "growth_channel_directory"]);
const MARKETPLACE_SALE_TABLES = Object.freeze(["creator_version_files", "creator_marketplace_orders", "creator_licence_grants", "creator_marketplace_payment_events"]);
// Cinematic scroll sites. One table holding one row per site, whose `document`
// column is a JSON site validated by lib/sonara-scroll-site.cjs. Its own group
// rather than folded into the Growth Studio list: the migration is its own
// file, and a group whose name does not match its feature is a group nobody
// finds when they go looking for it.
const SCROLL_SITE_TABLES = Object.freeze(["scroll_sites"]);
const CONNECTED_PAYMENT_TABLES = Object.freeze(["business_payment_accounts"]);
const PUSH_SUBSCRIPTION_TABLES = Object.freeze(["push_subscriptions"]);
const CALL_TABLES = Object.freeze(["call_sessions", "call_signals"]);
const RECORD_CHANGE_LOG_TABLES = Object.freeze(["record_change_log"]);
const TWO_FACTOR_TABLES = Object.freeze(["user_auth_factors", "user_recovery_codes", "pending_auth_challenges"]);
const GROWTH_STUDIO_TABLES = Object.freeze([
  "growth_provider_connections",
  "growth_audience_segments",
  "growth_contact_consents",
  "growth_touchpoints",
  "growth_conversions",
  "growth_content_queue",
  "growth_provider_jobs",
  "growth_metric_snapshots",
  "growth_experiment_variants",
  "growth_control_events",
  // What a good customer looks like, the front door, one visitor's
  // conversation, and who gets the lead. Read by
  // routes/sonara-lead-capture-routes.cjs -- the public /chat/:slug widget and
  // the Growth Studio owner pages behind it.
  "lead_icp_profiles",
  "lead_capture_pages",
  "lead_conversations",
  "lead_routing_rules",
  // Who a campaign send actually reached, one row per recipient. Written by
  // lib/growth-studio-send-records.cjs through routes/growth-studio-control-routes.cjs
  // and read back to work out the remainder -- see migration
  // 20260916040000_growth_campaign_send_records.sql for why no rows must never
  // be read as "nobody was reached".
  "growth_campaign_sends",
  // What a campaign cost, as the owner recorded it. Append-only; written and
  // read on the campaign's own page in routes/growth-studio-control-routes.cjs.
  // Migration 20261007090000_what_a_campaign_cost.sql.
  "growth_campaign_spend",
  // What the email provider reported after accepting a campaign message:
  // delivered, bounced, complained, opened. Written by POST /api/webhooks/resend
  // (routes/sonara-email-receipt-routes.cjs) and read on the campaign's page.
  // Migration 20261007130000_what_happened_to_a_campaign_email.sql.
  "growth_email_delivery_events"
]);
const PRODUCT_LIFECYCLE_TABLES = Object.freeze([
  "product_lifecycle_initiatives",
  "product_lifecycle_evidence",
  "product_lifecycle_requirements",
  "product_lifecycle_iterations",
  "product_lifecycle_feedback",
  "product_lifecycle_stage_reviews",
  "product_lifecycle_events"
]);
const MARKET_INTELLIGENCE_TABLES = Object.freeze([
  "market_intelligence_segments",
  "market_intelligence_competitors",
  "market_intelligence_signals",
  "market_intelligence_opportunities",
  "market_intelligence_reviews",
  "market_intelligence_events"
]);
// Which sites a business has established it may research.
//
// Created by the platform redesign migration on 28 May 2026, which predates the
// runtime contract migration that pins the canonical 145 -- it was left out of
// that list because at the time nothing read it. It became visible to the scan
// below when the crawl permission gate in routes/market-intelligence-routes.cjs
// started asking it whether a host may be fetched, which is the first code in
// this product ever to read the table. Reviewed here rather than added to the
// canonical list, because that count is pinned by the contract migration and
// this table is not in it.
const RESEARCH_INTAKE_TABLES = Object.freeze([
  "research_sources"
]);
const PROMPT_LIBRARY_TABLES = Object.freeze([
  "sonara_prompt_templates",
  "sonara_prompt_versions",
  "sonara_prompt_tags",
  "sonara_prompt_template_tags",
  "sonara_prompt_collections",
  "sonara_prompt_collection_items",
  "sonara_prompt_connections",
  "sonara_prompt_runs",
  "sonara_prompt_reports",
  "sonara_prompt_import_batches"
]);
const contractMigrationPath = path.join(migrationsDirectory, contractMigrationName);
const usageLedgerMigrationPath = path.join(migrationsDirectory, usageLedgerMigrationName);
const managementCredentialMigrationPath = path.join(migrationsDirectory, managementCredentialMigrationName);
const referenceContractExtensionPath = path.join(migrationsDirectory, referenceContractExtensionName);
const productLifecycleMigrationPath = path.join(migrationsDirectory, productLifecycleMigrationName);
const marketIntelligenceMigrationPath = path.join(migrationsDirectory, marketIntelligenceMigrationName);
const researchIntakeMigrationPaths = researchIntakeMigrationNames.map((name) => path.join(migrationsDirectory, name));
const promptLibraryMigrationPath = path.join(migrationsDirectory, promptLibraryMigrationName);
const promptLibrarySecurityMigrationPath = path.join(migrationsDirectory, promptLibrarySecurityMigrationName);
const recurringTaskMigrationPath = path.join(migrationsDirectory, recurringTaskMigrationName);
const operationalIndexMigrationPath = path.join(migrationsDirectory, operationalIndexMigrationName);
const {
  DATABASE_FUNCTIONS,
  DATABASE_INDEXES,
  DATABASE_SCHEMAS,
  DATABASE_TABLE_GROUPS,
  DATABASE_TABLES,
  DURABLE_EVENT_FOUNDATION_FUNCTIONS,
  DURABLE_EVENT_FOUNDATION_TABLES,
  DURABLE_WORKER_FUNCTIONS,
  TRANSLATION_FOUNDATION_TABLES,
  STORAGE_BUCKETS
} = require(path.join(root, "lib", "sonara-database-contract.cjs"));
const { getAllManifestTables } = require(path.join(root, "lib", "sonara-ecosystem-manifest.cjs"));

function fail(message) {
  console.error(`Supabase contract verification failed: ${message}`);
  process.exitCode = 1;
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function readExtension(names, label) {
  return names.map((name) => {
    const filePath = path.join(migrationsDirectory, name);
    if (!fs.existsSync(filePath)) {
      fail(`missing ${label} migration: ${name}`);
      return "";
    }
    return read(filePath);
  }).join("\n").toLowerCase();
}

const migrationFiles = fs.readdirSync(migrationsDirectory)
  .filter((name) => name.endsWith(".sql"))
  .sort();
const allSql = migrationFiles.map((name) => read(path.join(migrationsDirectory, name))).join("\n").toLowerCase();
const contractSql = [contractMigrationPath, referenceContractExtensionPath, productLifecycleMigrationPath, marketIntelligenceMigrationPath, promptLibraryMigrationPath, promptLibrarySecurityMigrationPath, usageLedgerMigrationPath, managementCredentialMigrationPath, recurringTaskMigrationPath]
  .map(read)
  .join("\n")
  .toLowerCase();
const operationalIndexSql = read(operationalIndexMigrationPath).toLowerCase();
const businessControlSql = readExtension(businessControlMigrationNames, "Business Builder control-plane");
const creatorProjectSql = readExtension(creatorProjectMigrationNames, "Creator Project Graph");
const creatorGenerationSql = readExtension(creatorGenerationMigrationNames, "Creator Studio generation control-plane");
const creatorArtistSystemSql = readExtension(creatorArtistSystemMigrationNames, "Creator Studio artist system");
const businessOperationsSql = readExtension(businessOperationsMigrationNames, "Business Builder operations");
const agentQueueSql = readExtension(agentQueueMigrationNames, "agent approval queue");
const agentToolPermissionSql = readExtension(agentToolPermissionMigrationNames, "agent tool permissions");
const creatorProjectGraphSql = readExtension(creatorProjectGraphMigrationNames, "Creator Studio project graph");
const growthEventSql = readExtension(growthEventMigrationNames, "Growth Studio events and RSVPs");
const merchantStoreSql = readExtension(merchantStoreMigrationNames, "merchant storefront and orders");
const inventoryStockSql = readExtension(inventoryStockMigrationNames, "inventory stock ledger");
const growthStudioSql = readExtension(growthStudioMigrationNames, "Growth Studio control-plane");
const scrollSiteSql = readExtension(scrollSiteMigrationNames, "cinematic scroll sites");
const connectedPaymentSql = readExtension(connectedPaymentMigrationNames, "connected payment accounts");
const pushSubscriptionSql = readExtension(pushSubscriptionMigrationNames, "push subscriptions");
const callSql = readExtension(callMigrationNames, "calls");
const recordChangeLogSql = readExtension(recordChangeLogMigrationNames, "record change log");
const twoFactorSql = readExtension(twoFactorMigrationNames, "two-factor authentication");
const durableEventFoundationSql = readExtension(durableEventFoundationMigrationNames, "durable event foundation");
const translationFoundationSql = readExtension(translationFoundationMigrationNames, "translation foundation");
const productLifecycleSql = read(productLifecycleMigrationPath).toLowerCase();
const marketIntelligenceSql = read(marketIntelligenceMigrationPath).toLowerCase();
// Two migrations: the one that created the table, and the one that gave
// permission_status and crawl_status the values they are allowed to hold.
const researchIntakeSql = researchIntakeMigrationPaths.map((file) => read(file)).join("\n").toLowerCase();
const promptLibrarySql = [promptLibraryMigrationPath, promptLibrarySecurityMigrationPath].map(read).join("\n").toLowerCase().replace(/\s+/g, " ").trim();
const config = read(path.join(root, "supabase", "config.toml"));
const mcpText = read(path.join(root, ".mcp.json"));
const mcp = JSON.parse(mcpText);

if (DATABASE_TABLES.length !== new Set(DATABASE_TABLES).size) fail("the canonical table list contains duplicates");
// Historical baseline: expected 135 canonical tables before Prompt Library added 10 organization-scoped tables.
// 146 since 10 September 2026: usage_credit_ledger, the append-only credit
// ledger that lets the six priced metered capabilities actually be charged for.
// 147 since 1 October 2026: business_management_credentials, the owner-held
// passcode that gates employee, time-clock and payroll surfaces behind
// something known rather than something the browser holds.
// 147 since 1 October 2026: business_recurring_tasks, the template behind work
// that comes round again. Its occurrences are rows in employee_tasks, which was
// already here -- the count rose by one because one table was added, not because
// a second kind of task arrived.
if (DATABASE_TABLES.length !== 148) fail(`expected 148 canonical tables, found ${DATABASE_TABLES.length}`);
if (Object.values(DATABASE_TABLE_GROUPS).flat().length !== DATABASE_TABLES.length) fail("a table appears in more than one contract group");
if (DATABASE_FUNCTIONS.length !== 11) fail(`expected 11 contract functions, found ${DATABASE_FUNCTIONS.length}`);
if (DATABASE_INDEXES.length !== 8) fail(`expected 8 operational indexes, found ${DATABASE_INDEXES.length}`);
if (new Set(DATABASE_INDEXES.map((index) => index.name)).size !== DATABASE_INDEXES.length) fail("the operational index list contains duplicate names");
if (DATABASE_SCHEMAS.join(",") !== "public,auth,storage") fail("expected public, auth, and storage schemas");

const manifestTables = [...new Set(getAllManifestTables().filter((table) => !table.includes(".")))];
for (const table of manifestTables) {
  if (!DATABASE_TABLES.includes(table)) fail(`ecosystem manifest references public.${table}, but it is absent from the canonical contract`);
}

for (const table of DATABASE_TABLES) {
  const createPattern = new RegExp(`create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?public\\.${table}\\b`, "i");
  if (!createPattern.test(allSql)) fail(`no migration creates public.${table}`);
  if (!contractSql.includes(`'${table}'`) && !contractSql.includes(`public.${table}`)) fail(`the runtime migration does not check public.${table}`);
}

verifyExtension(BUSINESS_CONTROL_TABLES, businessControlSql, "Business Builder");
for (const required of [
  "public.sonara_is_org_member(organization_id)",
  "public.is_org_owner_or_admin(organization_id)",
  "auth.role() = 'service_role'",
  "revoke select (credential_reference) on public.business_integration_connections from anon, authenticated"
]) {
  if (!businessControlSql.includes(required)) fail(`Business Builder control-plane extension is missing: ${required}`);
}

verifyExtension(CREATOR_PROJECT_TABLES, creatorProjectSql, "Creator Project Graph");
for (const required of ["revoke all on public.creator_projects from public, anon, authenticated", "grant select on public.creator_projects to authenticated", "grant all on public.creator_projects to service_role", "public.sonara_is_org_member(organization_id)", "revision integer not null", "graph jsonb not null"]) {
  if (!creatorProjectSql.includes(required)) fail(`Creator Project Graph extension is missing: ${required}`);
}
for (const required of ["security invoker", "pg_advisory_xact_lock", "grant select, insert, update on public.generation_usage_reservations to service_role", "revoke all on function public.generation_usage(uuid, text, uuid, numeric, jsonb) from public, anon, authenticated"]) {
  if (!creatorProjectSql.includes(required)) fail(`Included generation contract is missing: ${required}`);
}
verifyExtension(CREATOR_GENERATION_TABLES, creatorGenerationSql, "Creator Studio generation");
verifyExtension(CREATOR_ARTIST_SYSTEM_TABLES, creatorArtistSystemSql, "Creator Studio artist system");
// BUSINESS_OPERATIONS_TABLES was only ever used to stop the runtime scan
// failing -- it was in the reviewed set and passed through no create-or-RLS
// check at all, so a table could be listed here and exist nowhere.
verifyExtension(BUSINESS_OPERATIONS_TABLES, businessOperationsSql, "Business Builder operations");
for (const required of [
  "create or replace function public.sonara_record_work_order_creation",
  "create trigger sonara_work_order_created_event",
  "create or replace function public.sonara_create_work_order_from_quote",
  "create or replace function public.sonara_transition_work_order",
  "create or replace function public.sonara_invoice_work_order",
  "set search_path = ''",
  "if auth.role() <> 'service_role'",
  "for update",
  "revoke all on function public.sonara_create_work_order_from_quote(uuid, uuid, uuid) from public, anon, authenticated",
  "grant execute on function public.sonara_create_work_order_from_quote(uuid, uuid, uuid) to service_role",
  "revoke all on function public.sonara_transition_work_order(uuid, uuid, uuid, text, text) from public, anon, authenticated",
  "grant execute on function public.sonara_transition_work_order(uuid, uuid, uuid, text, text) to service_role",
  "revoke all on function public.sonara_invoice_work_order(uuid, uuid, uuid) from public, anon, authenticated",
  "grant execute on function public.sonara_invoice_work_order(uuid, uuid, uuid) to service_role",
  "add column if not exists work_order_id uuid references public.business_work_orders(id)"
]) {
  if (!businessOperationsSql.includes(required.toLowerCase())) fail(`Business Builder work-order extension is missing: ${required}`);
}
verifyExtension(AGENT_QUEUE_TABLES, agentQueueSql, "agent approval queue");
// The queue exists so an approval has something to re-run. A migration that
// created the table without the column carrying the action's inputs would pass
// every check above and leave the queue unable to do the one thing it is for.
for (const required of ["payload jsonb", "state text not null default 'waiting'", "auth.role() = 'service_role'", "time_zone text not null"]) {
  if (!agentQueueSql.includes(required.toLowerCase())) fail(`the agent approval queue migration is missing: ${required}`);
}
verifyExtension(AGENT_TOOL_PERMISSION_TABLES, agentToolPermissionSql, "agent tool permissions");
// Both defaults are the safe direction, and both are asserted in the SQL as well
// as in the migration's own do-block: a half-filled row must permit nothing. A
// later migration flipping either would turn an unfinished row into a grant, and
// `lib/sonara-agent-tool-permissions.cjs` reads the columns strictly on the same
// assumption.
//
// The organization column is checked because it is the entire reason this table
// exists rather than entity_agent_tool_registry being wired up -- that one keys on
// entity_id, and public.entities has no organization_id, so reading it to
// authorise an organization's run would cross tenants.
for (const required of [
  "allowed boolean not null default false",
  "requires_approval boolean not null default true",
  "organization_id uuid not null references public.organizations(id)",
  "unique (organization_id, tool_name)"
]) {
  if (!agentToolPermissionSql.includes(required.toLowerCase())) fail(`the agent tool permissions migration is missing: ${required}`);
}
// No delete grant. Withdrawing a permission is an update, which keeps the record
// of what was granted; a delete arriving later would erase it, and changing a
// security setting is an owner-approval category in AGENTS.md.
if (/grant[^;]*delete[^;]*agent_tool_permissions/.test(agentToolPermissionSql)) {
  fail("the agent tool permissions migration grants DELETE; withdrawing a permission is an update so the record of what was granted survives");
}
verifyExtension(CREATOR_APPROVAL_GRAPH_TABLES, creatorProjectGraphSql, "Creator Studio project graph");
// `ai_disclosure boolean` with no NOT NULL and no default. Asserted as the exact
// column declaration rather than by absence of "not null", because absence is
// what a weaker check measures and absence is satisfied by the column having been
// renamed or removed. The migration's own do-block asserts is_nullable = 'YES'
// against the live catalogue; this asserts the text that produces it, so the two
// fail for different reasons and a change that defeats one does not pass the other.
if (!/\bai_disclosure\s+boolean\s*,/.test(creatorProjectGraphSql)) {
  fail("creator_asset_versions.ai_disclosure must be declared `ai_disclosure boolean` -- nullable, so an unanswered disclosure question stays unanswered rather than reading as 'not AI-generated'");
}
if (/ai_disclosure\s+boolean[^,]*(not\s+null|default)/.test(creatorProjectGraphSql)) {
  fail("creator_asset_versions.ai_disclosure must not be NOT NULL or defaulted; a default would make the schema assert a provenance answer nobody gave");
}
// An approval belongs to one version, not to the asset. If this foreign key ever
// pointed at creator_assets, approving one version would silently approve every
// later edit of the same asset -- which is the gate-that-was-never-there shape, in
// the schema rather than in a page.
if (!/asset_version_id\s+uuid\s+not\s+null\s+references\s+public\.creator_asset_versions\(id\)/.test(creatorProjectGraphSql)) {
  fail("creator_asset_approvals.asset_version_id must reference public.creator_asset_versions(id); an approval on the asset would carry forward to versions nobody reviewed");
}
for (const required of [
  "organization_id uuid not null references public.organizations(id)",
  "unique (asset_id, version_number)",
  "check (version_number >= 1)"
]) {
  if (!creatorProjectGraphSql.includes(required.toLowerCase())) fail(`the Creator Studio project graph migration is missing: ${required}`);
}
// brief_id has to stay nullable: creator_assets already holds rows, and an asset
// that predates briefs does not belong to one.
if (!/add\s+column\s+if\s+not\s+exists\s+brief_id\s+uuid\s+references\s+public\.creator_briefs\(id\)/.test(creatorProjectGraphSql)) {
  fail("the Creator Studio project graph migration must add creator_assets.brief_id as a nullable reference; existing assets belong to no brief");
}
// No delete grant on any of the three. A rejected version and a withdrawn
// approval are states, not absences: deleting the row would erase the record that
// somebody said no, and `destructive data changes` is an owner-approval category
// in AGENTS.md.
for (const table of CREATOR_APPROVAL_GRAPH_TABLES) {
  if (new RegExp(`grant[^;]*delete[^;]*${table}`).test(creatorProjectGraphSql)) {
    fail(`the Creator Studio project graph migration grants DELETE on ${table}; a rejection is a recorded state and deleting it erases the record`);
  }
}

verifyExtension(GROWTH_EVENT_TABLES, growthEventSql, "Growth Studio events and RSVPs");
// Capacity is three-state on both tables, and that is the whole feature.
// `not null default 0` would make every event with an unfilled box an event nobody
// can attend; `not null default` anything else invents a room size somebody gets
// turned away on. Asserted as the exact declaration rather than by absence of
// "not null", because absence is also satisfied by the column having been removed.
for (const table of ["growth_venues", "growth_events"]) {
  if (!new RegExp(`capacity integer check \\(capacity is null or capacity >= 0\\)`).test(growthEventSql)) {
    fail(`${table}.capacity must be declared \`capacity integer check (capacity is null or capacity >= 0)\` -- nullable, so "nobody has recorded a capacity" stays a state distinct from zero`);
    break;
  }
}
if (/capacity integer[^,]*(not null|default)/.test(growthEventSql)) {
  fail("a capacity column is NOT NULL or defaulted; absent capacity would become a number nobody recorded");
}
// And the same for the attendance answer.
if (!/\battending boolean,/.test(growthEventSql)) {
  fail("growth_event_rsvps.attending must be declared `attending boolean` -- nullable, so somebody who has not answered has not declined");
}
if (/attending boolean[^,]*(not null|default)/.test(growthEventSql)) {
  fail("growth_event_rsvps.attending is NOT NULL or defaulted; an unanswered question would become a no");
}
// One person, one RSVP per event. Without it, a refreshed form holds two seats for
// one person and the count an owner reads is wrong in the direction that makes
// them turn people away.
if (!/unique index if not exists growth_event_rsvps_person_key[\s\S]{0,120}\(event_id, lower\(email\)\)/.test(growthEventSql)) {
  fail("growth_event_rsvps has no unique index on (event_id, lower(email)); one person could hold two seats");
}
// Published and addressable are the same thing, enforced at the table rather than
// only in the form.
if (!/check \(status <> 'published' or slug is not null\)/.test(growthEventSql)) {
  fail("growth_events can be published with no slug; there would be no page to publish it to");
}
// Nothing here holds money or a card. An RSVP is not a ticket, and AGENTS.md
// forbids storing raw card data or CVV -- the way to be certain is to have nowhere
// to put it.
//
// Measured against the schema half, with comments stripped. Two false positives
// in a row, both shape 7 -- pattern matching prose as code -- in a check written
// minutes earlier:
//
//   1. the whole file matched, because the migration's own do-block names
//      '%price%' and '%card%' in the assertion that no such column exists;
//   2. the schema half still matched, because the header comment says AGENTS.md
//      "forbids storing raw card data or CVV".
//
// So the split is at `do $$` -- everything before declares, everything after
// asserts -- and SQL comments come out with lib/sonara-comment-stripping.cjs
// rather than a regex written here, which is what
// tests/a-line-comment-cannot-open-a-block-comment.test.js requires.
const { withoutSqlComments } = require(path.join(root, "lib", "sonara-comment-stripping.cjs"));
const growthEventSchemaSql = withoutSqlComments(growthEventSql.split("do $$")[0]);
if (growthEventSchemaSql.length < 2000) {
  fail(`the Growth Studio events schema half is ${growthEventSchemaSql.length} bytes; the split on \`do $$\` has stopped working and these assertions are measuring almost nothing`);
}
if (/\b(card_number|cvv|price_cents|amount_cents|payment_intent|stripe_)/.test(growthEventSchemaSql)) {
  fail("an events table holds a price, an amount or a card reference; an RSVP is not a ticket and card data must not be stored");
}
// No delete grant on any of the three. A withdrawn RSVP and a cancelled event are
// recorded states; deleting either erases a record somebody will ask about.
for (const table of GROWTH_EVENT_TABLES) {
  if (new RegExp(`grant[^;]*delete[^;]*${table}`).test(growthEventSql)) {
    fail(`the Growth Studio events migration grants DELETE on ${table}; a withdrawal is a recorded state and deleting it erases it`);
  }
}
for (const required of [
  "organization_id uuid not null references public.organizations(id)",
  "party_size integer not null default 1 check (party_size between 1 and 50)",
  "check (ends_at is null or ends_at >= starts_at)"
]) {
  if (!growthEventSql.includes(required.toLowerCase())) fail(`the Growth Studio events migration is missing: ${required}`);
}

verifyExtension(MERCHANT_STORE_TABLES, merchantStoreSql, "merchant storefront and orders");
verifyExtension(INVENTORY_STOCK_TABLES, inventoryStockSql, "inventory stock ledger");
// The schema half, comments stripped -- the same split as the events check above,
// and for the same reason: the do-block names '%card%' in order to assert no such
// column exists, and the header comment quotes AGENTS.md on card data.
const merchantStoreSchemaSql = withoutSqlComments(merchantStoreSql.split("do $$")[0]);
if (merchantStoreSchemaSql.length < 2000) {
  fail(`the merchant storefront schema half is ${merchantStoreSchemaSql.length} bytes; the split on \`do $$\` has stopped working and these assertions are measuring almost nothing`);
}
// No card, no CVV, no payment token. AGENTS.md forbids storing raw card data, and
// the way to be certain is to have nowhere to put it: taking the money runs through
// the organization's own connected account.
if (/\b(card_number|cardnumber|cvv|pan_|payment_token|card_token)/.test(merchantStoreSchemaSql)) {
  fail("a storefront table holds a card, a CVV or a payment token; raw card data must never be stored and payment runs through the connected account");
}
// A line's money and quantity are frozen copies and must always be there. A line
// with no price is a line that cannot be totalled, and the point of copying the
// figure is that it is never absent.
for (const required of [
  "unit_price_cents integer not null check (unit_price_cents >= 0)",
  "line_total_cents integer not null check (line_total_cents >= 0)",
  "quantity integer not null check (quantity between 1 and 999)",
  "subtotal_cents integer not null check (subtotal_cents >= 0)",
  "enabled boolean not null default false",
  "organization_id uuid not null references public.organizations(id)"
]) {
  if (!merchantStoreSchemaSql.includes(required.toLowerCase())) {
    fail(`the merchant storefront migration is missing: ${required}`);
  }
}
// Unpublished until published, and one address names one shop.
if (!/create unique index if not exists merchant_storefronts_slug_key/.test(merchantStoreSchemaSql)) {
  fail("merchant_storefronts.slug is not unique; one public address could name two shops");
}
if (!/create unique index if not exists merchant_storefronts_organization_key/.test(merchantStoreSchemaSql)) {
  fail("merchant_storefronts has no unique index per organization; \"the shop\" would be ambiguous everywhere it is read");
}
// No delete grant. A cancelled order is a recorded state that both the buyer and
// the owner need.
for (const table of MERCHANT_STORE_TABLES) {
  if (new RegExp(`grant[^;]*delete[^;]*${table}`).test(merchantStoreSql)) {
    fail(`the merchant storefront migration grants DELETE on ${table}; a cancelled order is a recorded state and deleting it erases it`);
  }
}
for (const required of [
  "public.sonara_is_org_member(organization_id)",
  "auth.role() = ''service_role''",
  "rights_attested boolean not null default false",
  "consent_attested boolean not null default false",
  "identity_imitation_prohibited",
  "auth.uid() = user_id or public.is_org_owner_or_admin(organization_id)",
  "revoke insert, update, delete on public.creator_generation_jobs from anon, authenticated",
  "revoke insert, update, delete on public.creator_generation_assets from anon, authenticated",
  "revoke insert, update, delete on public.creator_reference_analyses from anon, authenticated",
  "revoke insert, update, delete on public.creator_generation_events from anon, authenticated",
  "revoke delete on public.creator_voice_consents from anon, authenticated",
  "notify pgrst, 'reload schema'"
]) {
  if (!creatorGenerationSql.includes(required)) fail(`Creator Studio generation extension is missing: ${required}`);
}
if (/api_key\s+text|secret_key\s+text|access_token\s+text/i.test(creatorGenerationSql)) {
  fail("Creator Studio generation tables must not persist provider credentials");
}

verifyExtension(GROWTH_STUDIO_TABLES, growthStudioSql, "Growth Studio");
verifyExtension(SCROLL_SITE_TABLES, scrollSiteSql, "Cinematic scroll sites");
verifyExtension(CONNECTED_PAYMENT_TABLES, connectedPaymentSql, "Connected payment accounts");
verifyExtension(PUSH_SUBSCRIPTION_TABLES, pushSubscriptionSql, "Push subscriptions");
verifyExtension(CALL_TABLES, callSql, "Calls");
verifyExtension(RECORD_CHANGE_LOG_TABLES, recordChangeLogSql, "Record change log");
verifyExtension(TWO_FACTOR_TABLES, twoFactorSql, "Two-factor authentication");
verifyExtension(DURABLE_EVENT_FOUNDATION_TABLES, durableEventFoundationSql, "Durable event foundation");
verifyExtension(TRANSLATION_FOUNDATION_TABLES, translationFoundationSql, "Translation foundation");
const normalizedDurableEventFoundationSql = durableEventFoundationSql.replace(/\s+/g, "");
for (const signature of DURABLE_EVENT_FOUNDATION_FUNCTIONS) {
  const functionName = signature.slice("public.".length, signature.indexOf("("));
  const createPattern = new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${functionName}\\s*\\(`, "i");
  if (!createPattern.test(durableEventFoundationSql)) fail(`durable event foundation does not define ${signature}`);
  if (!normalizedDurableEventFoundationSql.includes(`grantexecuteonfunction${signature}toservice_role`)) {
    fail(`durable event foundation does not grant ${signature} to service_role`);
  }
}
const normalizedDurableWorkerSql = durableEventFoundationSql.replace(/\s+/g, "");
for (const signature of DURABLE_WORKER_FUNCTIONS) {
  const functionName = signature.slice("public.".length, signature.indexOf("("));
  const createPattern = new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${functionName}\\s*\\(`, "i");
  if (!createPattern.test(durableEventFoundationSql)) fail(`durable worker foundation does not define ${signature}`);
  if (!normalizedDurableWorkerSql.includes("securityinvokersetsearch_path=public,pg_temp")) {
    fail(`durable worker RPC must use SECURITY INVOKER and a pinned search_path: ${signature}`);
  }
  if (!normalizedDurableWorkerSql.includes(`revokeallonfunction${signature}frompublic,anon,authenticated`)) {
    fail(`durable worker RPC is executable by an untrusted role: ${signature}`);
  }
  if (!normalizedDurableWorkerSql.includes(`grantexecuteonfunction${signature}toservice_role`)) {
    fail(`durable worker RPC is not granted to service_role: ${signature}`);
  }
}
const normalizedTranslationFoundationSql = translationFoundationSql.replace(/\s+/g, "");
if (!normalizedTranslationFoundationSql.includes("forselecttoauthenticatedusing") || !translationFoundationSql.includes("organization_memberships") || !normalizedTranslationFoundationSql.includes("(selectauth.uid())")) {
  fail("translation foundation is missing tenant-scoped authenticated read policies");
}
if (!normalizedTranslationFoundationSql.includes("foralltoservice_roleusing(true)withcheck(true)")) {
  fail("translation foundation is missing service-role write policies");
}

// Nothing in the second factor is stored in a form somebody could use.
//
// Checked here rather than left to the modules that write it, because a column
// added straight to the migration would otherwise arrive with nothing
// objecting -- and a table of TOTP shared secrets in the clear is every second
// factor on the system, usable immediately by anyone who reads it.
//
// Matched as whole column names at the start of a line, not as substrings. The
// first version of this listed "secret text not null," and fired on
// `sealed_secret text not null,` -- a check that refused the very construction
// it exists to require.
for (const forbidden of ["secret", "totp_secret", "recovery_code", "plain_secret", "access_token", "refresh_token", "session_token"]) {
  const declares = new RegExp(`^\\s*${forbidden}\\s+(text|bytea|jsonb)\\b`, "m");
  if (declares.test(twoFactorSql)) {
    fail(`the two-factor migration declares a column named ${forbidden}; secrets, recovery codes and parked sessions are stored sealed or hashed, never in the clear`);
  }
}
for (const required of ["sealed_secret text not null", "sealed_session text not null", "token_hash text not null", "last_used_step"]) {
  if (!twoFactorSql.includes(required)) {
    fail(`the two-factor migration no longer declares ${required}, which is what keeps a secret, a session, a challenge id or a spent code out of reach`);
  }
}

// The change log holds no values, and that is checked here rather than left to
// the module that writes it. A column added straight to the migration would
// otherwise arrive with nothing objecting -- and a log of who changed a
// customer's phone number is a very different table from a log holding the
// number.
for (const forbidden of ["old_value", "new_value", "before_value", "after_value", "previous_value", "payload jsonb", "values jsonb"]) {
  if (recordChangeLogSql.includes(forbidden)) {
    fail(`record_change_log declares ${forbidden}; this table records which fields changed and must hold no values`);
  }
}
for (const required of [
  "public.sonara_is_org_member(organization_id)",
  "auth.role() = ''service_role''",
  "credential_reference text",
  "revoke select (credential_reference) on public.growth_provider_connections from anon, authenticated",
  "purpose- and channel-specific consent evidence",
  "attribution_model text not null",
  "attribution_confidence text not null",
  "sampled boolean not null default false",
  "approval_required boolean not null default false",
  "human-approved content scheduling",
  "revoke insert, update, delete on public.growth_provider_jobs from anon, authenticated",
  "revoke insert, update, delete on public.growth_control_events from anon, authenticated",
  "notify pgrst, 'reload schema'"
]) {
  if (!growthStudioSql.includes(required)) fail(`Growth Studio extension is missing: ${required}`);
}
if (/api_keys+text|secret_keys+text|access_tokens+text|refresh_tokens+text/i.test(growthStudioSql)) {
  fail("Growth Studio tables must not persist provider credentials");
}

verifyExtension(PRODUCT_LIFECYCLE_TABLES, productLifecycleSql, "Product lifecycle");
for (const required of [
  "public.sonara_is_org_member(organization_id)",
  "auth.role() = ''service_role''",
  "revoke insert, update, delete on public.product_lifecycle_initiatives from anon, authenticated",
  "revoke insert, update, delete on public.product_lifecycle_evidence from anon, authenticated",
  "revoke insert, update, delete on public.product_lifecycle_requirements from anon, authenticated",
  "revoke insert, update, delete on public.product_lifecycle_iterations from anon, authenticated",
  "revoke insert, update, delete on public.product_lifecycle_feedback from anon, authenticated",
  "revoke insert, update, delete on public.product_lifecycle_stage_reviews from anon, authenticated",
  "revoke insert, update, delete on public.product_lifecycle_events from anon, authenticated"
]) {
  if (!productLifecycleSql.includes(required)) fail(`Product lifecycle extension is missing: ${required}`);
}

verifyExtension(RESEARCH_INTAKE_TABLES, researchIntakeSql, "Research intake");
// The gate reads permission_status and the database must hold it to three
// values. A check constraint added in a later migration is what makes the
// column a decision rather than free text, and asserting it here means removing
// it fails the build rather than quietly re-opening the column.
for (const required of [
  "permission_status text not null default 'needs_review'",
  "check (permission_status in ('needs_review', 'approved', 'declined'))",
  "check (crawl_status in ('disabled', 'enabled'))"
]) {
  if (!researchIntakeSql.includes(required)) fail(`Research intake extension is missing: ${required}`);
}

verifyExtension(MARKET_INTELLIGENCE_TABLES, marketIntelligenceSql, "Market intelligence");
for (const required of [
  "public.sonara_is_org_member(organization_id)",
  "auth.role() = ''service_role''",
  "source_url text not null check (source_url ~ '^https://')",
  "product_lifecycle_initiative_id uuid references public.product_lifecycle_initiatives(id)",
  "market_opportunity_id uuid references public.market_intelligence_opportunities(id)",
  "revoke insert, update, delete on public.market_intelligence_segments from anon, authenticated",
  "revoke insert, update, delete on public.market_intelligence_competitors from anon, authenticated",
  "revoke insert, update, delete on public.market_intelligence_signals from anon, authenticated",
  "revoke insert, update, delete on public.market_intelligence_opportunities from anon, authenticated",
  "revoke insert, update, delete on public.market_intelligence_reviews from anon, authenticated",
  "revoke insert, update, delete on public.market_intelligence_events from anon, authenticated",
  "notify pgrst, 'reload schema'"
]) {
  if (!marketIntelligenceSql.includes(required)) fail(`Market intelligence extension is missing: ${required}`);
}

verifyExtension(PROMPT_LIBRARY_TABLES, promptLibrarySql, "Prompt Library");
for (const required of [
  "public.is_org_member(organization_id)",
  "public.has_org_role(organization_id",
  "public.is_org_owner_or_admin(organization_id)",
  "auth.role() = ''service_role''",
  "create or replace function public.create_sonara_prompt_version",
  "revoke all on function public.create_sonara_prompt_version(uuid,text,text,text,text) from public, anon, authenticated",
  "grant execute on function public.create_sonara_prompt_version(uuid,text,text,text,text) to service_role",
  "grant select, insert, update, delete on table public.%i to service_role",
  "input_schema = v_input_schema",
  "members read visible prompt templates",
  "members read visible prompt collections"
]) {
  if (!promptLibrarySql.includes(required)) fail(`Prompt Library extension is missing: ${required}`);
}
if (/api_key\s+text|secret_key\s+text|access_token\s+text|refresh_token\s+text/i.test(promptLibrarySql)) {
  fail("Prompt Library tables must not persist provider credentials");
}

// server.js, routes/ and lib/.
//
// lib/ was missing, and it is runtime -- the same directory the production
// deploy gate greps for its paid-access markers, and where
// lib/sonara-record-checks.cjs queries creator_tracks and
// creator_release_tasks. Neither was in this contract, and this check reported
// no uncontracted references while not reading the file that made them. A scan
// that names two of the three runtime directories is a scan measuring a
// different population from the one it claims.
//
// The sentence above was learned once and then held only half. The walk it
// introduced read routes/ and lib/ with a flat readdirSync, so lib/catalog/ --
// four modules one directory down -- was outside the population, and a scan that
// reads two directories to a depth of one is still measuring a different
// population from the one it claims. Breadth was fixed; depth was not.
//
// lib/sonara-runtime-source-files.cjs is the one walk now, so the lesson cannot be
// half-held again. .cjs only, because that is what the runtime modules are.
const runtimeFiles = runtimeSourceFiles({ root, directories: ["routes", "lib"], extensions: [".cjs"] })
  .map((relative) => path.join(root, relative));
const runtimeBlindness = blindnessReason(runtimeFiles);
if (runtimeBlindness) {
  console.error(`ERROR: ${runtimeBlindness}`);
  process.exit(1);
}
const runtimeSource = runtimeFiles.map(read).join("\n");
const runtimeTableReferences = new Set();
for (const pattern of [
  /\/rest\/v1\/([a-z0-9_]+)/gi,
  /safeListTable\(\s*["']([a-z0-9_]+)["']/gi,
  /\btable\s*:\s*["']([a-z0-9_]+)["']/gi,
  /\brest\(\s*["']([a-z0-9_]+)["']/gi,
  // A table named through a constant.
  //
  // Added 19 August 2026, after a deliberately undeclared table name passed
  // every check above. The four patterns before this one all require the table
  // to appear as a literal at the point of use -- `/rest/v1/quotes`,
  // `rest("quotes")`. A module that does the ordinary thing instead:
  //
  //     const FOLLOW_TABLE = "creator_follows";
  //     await rest(config, `${FOLLOW_TABLE}?select=...`);
  //
  // is invisible to all four, so its tables were never checked against the
  // contract at all. Two route modules were in that state when this was found,
  // and one of them passed only because an unrelated file happened to contain
  // the same name as a literal.
  // The underscore before TABLE is load-bearing: without it this also matches
  // COSTABLE_RATE_TYPE in lib/sonara-labour-cost.cjs and reports "hourly" as a
  // table nobody has contracted.
  /\bconst\s+(?:[A-Z][A-Z0-9_]*_)?TABLE\s*=\s*["']([a-z0-9_]+)["']/g
]) {
  for (const match of runtimeSource.matchAll(pattern)) runtimeTableReferences.add(match[1]);
}
// Review-only Creator schema is not an applied migration. Allow exactly these
// default-off adapters through the runtime inventory, not as deployed tables.
const pendingCreatorContracts = [
  ["creator_world_bibles","creator-world-bibles-2026-10-09.sql","SONARA_CREATOR_WORLD_BIBLE_PERSISTENCE_ENABLED"],
  ["creator_story_drafts","creator-story-draft-revisions-2026-10-09.sql","SONARA_STORY_REVISION_PERSISTENCE_ENABLED"],
  ["creator_story_draft_revisions","creator-story-draft-revisions-2026-10-09.sql","SONARA_STORY_REVISION_PERSISTENCE_ENABLED"]
];
const pendingCreatorNames = new Set(pendingCreatorContracts.map(([name]) => name));
const proposalExample = read(path.join(root, ".env.example"));
const proposalRoutes = read(path.join(root, "routes/sonara-creator-project-routes.cjs"));
if (pendingCreatorNames.size !== 3) fail("Creator proposal inventory is not distinct");
for (const [name, file, flag] of pendingCreatorContracts) {
  const source = path.join(root, "docs/sql-proposals", file);
  if (!fs.existsSync(source)) { fail("missing Creator proposal: " + source); continue; }
  const sql = read(source).toLowerCase();
  if (!new RegExp("create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?public\\." + name + "\\s*\\(").test(sql) ||
      !sql.includes("alter table public." + name + " enable row level security;") ||
      !sql.includes("revoke all on public." + name + " from public, anon, authenticated, service_role;"))
    fail("Creator proposal missing DDL/RLS/grant-revocation contract: " + name);
  if (new RegExp("create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?public\\." + name + "\\s*\\(").test(allSql))
    fail("Creator pending table now migrated: promote reviewed contract " + name);
  if (!proposalExample.split("\n").includes(flag + "=false") || !proposalRoutes.includes(flag))
    fail("Creator proposal not behind a default-off route flag: " + name);
}
// The story revision history constant is checked here even though it does
// not match the runtime scanner's legacy *_TABLE pattern.
const reviewedExtensionTables = new Set([...CREATOR_PROJECT_TABLES, ...BUSINESS_OPERATIONS_TABLES, ...BUSINESS_CONTROL_TABLES, ...CREATOR_GENERATION_TABLES, ...CREATOR_ARTIST_SYSTEM_TABLES, ...AGENT_QUEUE_TABLES, ...AGENT_TOOL_PERMISSION_TABLES, ...GROWTH_STUDIO_TABLES, ...SCROLL_SITE_TABLES, ...CONNECTED_PAYMENT_TABLES, ...PUSH_SUBSCRIPTION_TABLES, ...CALL_TABLES, ...RECORD_CHANGE_LOG_TABLES, ...TWO_FACTOR_TABLES, ...DURABLE_EVENT_FOUNDATION_TABLES, ...TRANSLATION_FOUNDATION_TABLES, ...PRODUCT_LIFECYCLE_TABLES, ...PROMPT_LIBRARY_TABLES, ...RESEARCH_INTAKE_TABLES, ...CREATOR_APPROVAL_GRAPH_TABLES, ...GROWTH_EVENT_TABLES, ...MERCHANT_STORE_TABLES, ...INVENTORY_STOCK_TABLES, ...DEVICE_PERMISSION_TABLES, ...CREATOR_MARKETPLACE_TABLES, ...GROWTH_CHANNEL_TABLES, ...MARKETPLACE_SALE_TABLES]);
for (const table of [...runtimeTableReferences].sort()) {
  if (table === "rpc") continue;
  if (!DATABASE_TABLES.includes(table) && !reviewedExtensionTables.has(table) && !pendingCreatorNames.has(table)) {
    fail(`runtime references public.${table}, but it is absent from the canonical or reviewed extension contract`);
  }
}

for (const signature of DATABASE_FUNCTIONS) {
  const normalized = signature.toLowerCase();
  if (!contractSql.includes(`'${normalized}'`) && !contractSql.includes(normalized)) fail(`the readiness contract does not check or declare ${signature}`);
  const functionName = signature.slice("public.".length, signature.indexOf("("));
  const createPattern = new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${functionName}\\s*\\(`, "i");
  if (!createPattern.test(allSql)) fail(`no migration defines ${signature}`);
}

for (const index of DATABASE_INDEXES) {
  if (!DATABASE_TABLES.includes(index.table)) fail(`operational index ${index.name} references unknown table ${index.table}`);
  const createPattern = new RegExp(`create\\s+index\\s+if\\s+not\\s+exists\\s+${index.name}\\s+on\\s+public\\.${index.table}\\b`, "i");
  if (!createPattern.test(operationalIndexSql)) fail(`operational migration does not create ${index.name} on public.${index.table}`);
  if (!operationalIndexSql.includes(`'${index.name}'`)) fail(`operational migration does not assert ${index.name}`);
}

for (const requiredSql of [
  "classes.relrowsecurity",
  "grant select, insert, update, delete on table public.%i to service_role",
  "security invoker",
  "set search_path = ''",
  "revoke execute on function public.sonara_database_contract_snapshot() from public, anon, authenticated",
  "grant execute on function public.sonara_database_contract_snapshot() to service_role",
  "notify pgrst, 'reload schema'"
]) {
  if (!contractSql.includes(requiredSql)) fail(`contract migration is missing: ${requiredSql}`);
}

for (const requiredSql of [
  "pg_index",
  "indisvalid",
  "indisready",
  "where status = 'active'",
  "where status in ('active', 'trialing')",
  "notify pgrst, 'reload schema'"
]) {
  if (!operationalIndexSql.includes(requiredSql)) fail(`operational index migration is missing: ${requiredSql}`);
}
if (/create\s+table/i.test(operationalIndexSql)) fail("operational index migration must not add speculative tables");
if (/grant\s+/i.test(operationalIndexSql)) fail("operational index migration must not change Data API privileges");

if (!/auto_expose_new_tables\s*=\s*false/.test(config)) fail("local Data API must not auto-expose new tables");
if (!/\[db\.seed\][\s\S]*?enabled\s*=\s*false/.test(config)) fail("local seed execution must remain disabled until a reviewed seed exists");
if (!/minimum_password_length\s*=\s*8/.test(config)) fail("local Supabase Auth must enforce the application 8-character minimum password length");
// This used to exempt three buckets from the check below. They declared 100MiB
// and 150MiB against a free plan that caps a bucket at 50MiB, so storage refused
// them outright -- never capacity, only a promise rejected on arrival. They sit
// at 50MiB now and the exemption is gone, which is the state worth keeping: an
// exception list nobody has to remember to empty.

// "50MiB", "500KB", "1GB" -> MiB. Returns null for anything unparseable so a
// new unit form fails loudly at the comparison rather than silently passing.
function toMebibytes(value) {
  const match = String(value || "").trim().match(/^(\d+(?:\.\d+)?)\s*(B|KB|KiB|MB|MiB|GB|GiB)$/i);
  if (!match) return null;
  const size = Number(match[1]);
  const unit = match[2].toLowerCase();
  const factors = { b: 1 / 1048576, kb: 1000 / 1048576, kib: 1 / 1024, mb: 1000000 / 1048576, mib: 1, gb: 1000000000 / 1048576, gib: 1024 };
  return size * factors[unit];
}

const globalStorageLimit = toMebibytes(config.match(/\[storage\]([\s\S]*?)(?=\n\[)/)?.[1]?.match(/file_size_limit\s*=\s*"([^"]+)"/)?.[1]);
if (globalStorageLimit === null) fail("[storage] has no readable file_size_limit, so bucket limits cannot be checked against it");

for (const bucket of STORAGE_BUCKETS) {
  const escaped = bucket.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const section = config.match(new RegExp(`\\[storage\\.buckets\\.${escaped}\\]([\\s\\S]*?)(?=\\n\\[|$)`))?.[1] || "";
  if (!section) fail(`local config is missing storage bucket ${bucket}`);
  if (!/public\s*=\s*false/.test(section)) fail(`storage bucket ${bucket} must be private`);
  if (!/file_size_limit\s*=/.test(section)) fail(`storage bucket ${bucket} needs a file size limit`);
  // A bucket may not accept a file the storage service as a whole refuses,
  // except for the three recorded above. A fourth still fails here.
  const bucketLimit = toMebibytes(section.match(/file_size_limit\s*=\s*"([^"]+)"/)?.[1]);
  if (bucketLimit !== null && globalStorageLimit !== null && bucketLimit > globalStorageLimit) {
    fail(`storage bucket ${bucket} allows ${bucketLimit} MiB but [storage] file_size_limit is ${globalStorageLimit} MiB`);
  }
  if (!/allowed_mime_types\s*=/.test(section)) fail(`storage bucket ${bucket} needs a MIME allowlist`);
}

const mcpUrl = mcp?.mcpServers?.supabase?.url || "";
if (!mcpUrl.startsWith("https://mcp.supabase.com/mcp?")) fail("Supabase MCP must use the official HTTPS endpoint");
if (!mcpUrl.includes("project_ref=yqncsonkxgwhcxedgevk")) fail("Supabase MCP must be scoped to the linked project");
if (!mcpUrl.includes("read_only=true")) fail("Supabase MCP must remain read-only for production inspection");
if (/authorization|bearer|service[_-]?role|access[_-]?token/i.test(mcpText)) fail("Supabase MCP config must not contain credentials");

// The approval rule, checked here rather than only in its own tests.
//
// The nineteen agent tables have never had a runtime, and until now that alone
// was the guarantee. It is a guarantee that expires the moment anyone builds
// one, and it says nothing about what would be allowed then. So the release now
// also checks the rule that decides it: every category AGENTS.md names must be
// gated, and an action nobody has classified must go to the owner rather than
// through. Those two properties are what make a runtime safe to add, and this
// fails the release if either stops holding.
const agentAuthority = require(path.join(root, "lib", "sonara-agent-authority.cjs"));
const AGENTS_MD_CATEGORIES = [
  ["refunds", "issue_refund"],
  ["payout_changes", "update_payout_account"],
  ["legal_or_policy_publishing", "publish_privacy_policy"],
  ["customer_campaigns", "send_campaign"],
  ["proof_or_review_publishing", "publish_review"],
  ["security_settings", "rotate_api_key"],
  ["destructive_data_changes", "delete_customer_records"]
];
for (const [category, actionType] of AGENTS_MD_CATEGORIES) {
  const classification = agentAuthority.classifyAction(actionType);
  if (!classification.requiresOwnerApproval) fail(`agent action ${actionType} is not gated on owner approval`);
  if (classification.category !== category) fail(`agent action ${actionType} is classified ${classification.category}, expected ${category}`);
}
if (!agentAuthority.classifyAction("an_action_nobody_has_classified").requiresOwnerApproval) {
  fail("an unrecognised agent action must default to owner review, not run");
}
if (agentAuthority.decideExecution({ action: { id: "a", action_type: "issue_refund", requires_approval: false }, approval: null }).allowed) {
  fail("a sensitive agent action executed without an approval record");
}

// The volume cap sits in front of the same decision, so it is held to the same
// property as the breaker: it may escalate and it may never relax. A cap that
// could turn a gated action into an ungated one would be a hole in the seven
// categories rather than a limit on them, and it would be a hole that only shows
// up under load -- which is when nobody is reading this file.
const agentLimits = require(path.join(root, "lib", "sonara-agent-limits.cjs"));
const gatedUnderLoad = agentLimits.evaluateVolumeLimit(
  agentAuthority.classifyAction("issue_refund"),
  { ok: true, rows: Array.from({ length: 500 }, () => ({ at: new Date().toISOString(), actionType: "issue_refund" })) },
  { now: new Date(), actionType: "issue_refund" }
);
if (!gatedUnderLoad.requiresOwnerApproval) {
  fail("the agent volume limit relaxed a gated action; it may only ever escalate");
}
if (gatedUnderLoad.category !== "refunds") {
  fail(`the agent volume limit reclassified a refund as ${gatedUnderLoad.category}`);
}
// The numbers themselves, before anything built from them.
//
// The assertion below builds its row list FROM MAX_UNATTENDED_RUNS_PER_WINDOW, so
// raising the constant raises the list too and the assertion passes at any value
// -- it proves the code enforces whatever it declares, not that what it declares
// is a cap. Found by raising the constant to 100,000 and watching the check stay
// green, which is the shape this file is full of guards against.
//
// So the range is asserted separately. The floor is what makes it a cap at all;
// the ceiling is what stops it being raised until it cannot be reached. Sized
// against the product: the self-serve allowlist is read-and-report actions on
// daily-to-monthly cadences, so legitimate use is single digits an hour.
if (!(agentLimits.MAX_UNATTENDED_RUNS_PER_WINDOW >= 10 && agentLimits.MAX_UNATTENDED_RUNS_PER_WINDOW <= 500)) {
  fail(`the unattended agent cap is ${agentLimits.MAX_UNATTENDED_RUNS_PER_WINDOW} runs per window, outside the 10-500 range that makes it a cap a runaway can reach`);
}
if (!(agentLimits.MAX_UNATTENDED_RUNS_PER_ACTION_PER_WINDOW >= 5
  && agentLimits.MAX_UNATTENDED_RUNS_PER_ACTION_PER_WINDOW <= agentLimits.MAX_UNATTENDED_RUNS_PER_WINDOW)) {
  fail(`the per-action cap is ${agentLimits.MAX_UNATTENDED_RUNS_PER_ACTION_PER_WINDOW}, which is not a tighter bound inside the overall cap`);
}
if (!(agentLimits.LIMIT_WINDOW_MINUTES >= 5 && agentLimits.LIMIT_WINDOW_MINUTES <= 1440)) {
  fail(`the cap window is ${agentLimits.LIMIT_WINDOW_MINUTES} minutes, which is either too short to measure or too long to notice`);
}
if (!(agentAuthority.BREAKER_RECENCY_DAYS >= 7 && agentAuthority.BREAKER_RECENCY_DAYS <= 180)) {
  fail(`failures stop counting after ${agentAuthority.BREAKER_RECENCY_DAYS} days, which either forgets a bad week or remembers one for ever`);
}

// And the other direction: a self-serve action past the cap must be held, or the
// cap is a number nobody enforces.
const selfServeUnderLoad = agentLimits.evaluateVolumeLimit(
  agentAuthority.classifyAction(agentAuthority.SELF_SERVE_ACTIONS[0].action),
  { ok: true, rows: Array.from({ length: agentLimits.MAX_UNATTENDED_RUNS_PER_WINDOW }, () => ({ at: new Date().toISOString() })) },
  { now: new Date() }
);
if (!selfServeUnderLoad.requiresOwnerApproval || selfServeUnderLoad.limit !== "tripped") {
  fail(`an unattended agent action at ${agentLimits.MAX_UNATTENDED_RUNS_PER_WINDOW} runs in the window was not held for the owner`);
}

// --- tool permissions -------------------------------------------------------
//
// The same two directions the volume cap is checked in, because a permission
// model that only ever refuses is as broken as one that only ever permits, and
// only the second gets noticed.
const toolPermissions = require(path.join(root, "lib", "sonara-agent-tool-permissions.cjs"));
const permittedRow = (toolName) => ({ ok: true, rows: [{ toolName, allowed: true, requiresApproval: false }] });

// A tenant-editable row must never unlock a gated action, or the seven
// categories in lib/sonara-agent-authority.cjs become advisory. Checked against
// every sensitive category rather than one sample, so a pattern that stops
// matching is a failure here rather than a quieter probe.
for (const category of agentAuthority.SENSITIVE_CATEGORY_NAMES) {
  const probe = { issue_refund: "issue_refund", payout_changes: "change_payout_account" }[category] || category;
  const gated = agentAuthority.classifyAction(probe);
  if (!gated.requiresOwnerApproval) continue;
  const decided = toolPermissions.evaluateToolPermission(gated, permittedRow(probe), { toolName: probe });
  if (!decided.requiresOwnerApproval || decided.category !== gated.category) {
    fail(`a tool permission row relaxed ${probe}, which is gated under ${gated.category}; the permission model may only ever add refusals`);
  }
}

const selfServeAction = agentAuthority.SELF_SERVE_ACTIONS[0].action;
const selfServeBase = agentAuthority.classifyAction(selfServeAction);

// Unreadable escalates. This is deliberately the opposite of what a failed
// history read does to the breaker, and getting it backwards would mean an
// unreachable permission table grants every tool.
const unreadable = toolPermissions.evaluateToolPermission(selfServeBase, { ok: false, reason: "read failed (503)" }, { toolName: selfServeAction });
if (!unreadable.requiresOwnerApproval || unreadable.permission !== "unavailable") {
  fail(`an unreadable tool permission set did not hold ${selfServeAction} for the owner; absent evidence of permission must not grant one`);
}

// A configured organization denies a tool it has not listed.
const notListed = toolPermissions.evaluateToolPermission(selfServeBase, permittedRow("a_tool_this_organization_does_permit"), { toolName: selfServeAction });
if (!notListed.requiresOwnerApproval || notListed.permission !== "denied") {
  fail(`${selfServeAction} was not held although this organization's permissions do not list it`);
}

// And the other direction, which is what stops every assertion above being
// satisfied by a model that refuses everything.
const listed = toolPermissions.evaluateToolPermission(selfServeBase, permittedRow(selfServeAction), { toolName: selfServeAction });
if (listed.requiresOwnerApproval || listed.permission !== "allowed") {
  fail(`${selfServeAction} was held although this organization permits exactly that tool; a permission model that refuses everything is as broken as one that permits everything`);
}

// An unwired call site must report rather than deny, for the reason the breaker
// records: refusing every action is a worse way to discover a deployment gap
// than saying the check is not installed.
const unwiredPermission = toolPermissions.evaluateToolPermission(selfServeBase, null, { toolName: selfServeAction, hasReader: false });
if (unwiredPermission.requiresOwnerApproval || unwiredPermission.permission !== "unwired") {
  fail("a runner with no permission reader did not report the model as unwired; it must say so rather than deny or stay silent");
}

if (!process.exitCode) {
  console.log(`Supabase contract verified: ${DATABASE_SCHEMAS.length} schemas, ${DATABASE_TABLES.length} canonical tables, ${BUSINESS_CONTROL_TABLES.length} reviewed Business Builder extension tables, ${BUSINESS_OPERATIONS_TABLES.length} reviewed Business Builder operations tables, ${CREATOR_GENERATION_TABLES.length} reviewed Creator Studio generation tables, ${CREATOR_ARTIST_SYSTEM_TABLES.length} reviewed Creator Studio artist system tables, ${AGENT_QUEUE_TABLES.length} reviewed agent queue table(s), ${AGENT_TOOL_PERMISSION_TABLES.length} reviewed agent tool permission table(s), ${GROWTH_STUDIO_TABLES.length} reviewed Growth Studio extension tables, ${SCROLL_SITE_TABLES.length} reviewed scroll site table(s), ${CONNECTED_PAYMENT_TABLES.length} reviewed connected payment table(s), ${PUSH_SUBSCRIPTION_TABLES.length} reviewed push subscription table(s), ${CALL_TABLES.length} reviewed call table(s), ${RECORD_CHANGE_LOG_TABLES.length} reviewed record change log table(s), ${TWO_FACTOR_TABLES.length} reviewed two-factor tables, ${DURABLE_EVENT_FOUNDATION_TABLES.length} reviewed durable event foundation tables, ${TRANSLATION_FOUNDATION_TABLES.length} reviewed translation foundation tables, ${PRODUCT_LIFECYCLE_TABLES.length} reviewed Product Lifecycle tables, ${PROMPT_LIBRARY_TABLES.length} reviewed Prompt Library tables, ${RESEARCH_INTAKE_TABLES.length} reviewed research intake table(s), ${CREATOR_APPROVAL_GRAPH_TABLES.length} reviewed Creator Studio project graph tables, ${GROWTH_EVENT_TABLES.length} reviewed Growth Studio event tables, ${MERCHANT_STORE_TABLES.length} reviewed merchant storefront tables, ${DATABASE_FUNCTIONS.length} canonical functions and ${DURABLE_EVENT_FOUNDATION_FUNCTIONS.length} reviewed event functions and ${DURABLE_WORKER_FUNCTIONS.length} reviewed worker functions, ${DATABASE_INDEXES.length} operational indexes, ${STORAGE_BUCKETS.length} private buckets.`);
  // "schema-only" stopped being true when /research-lab/subsystems gained
  // forms: an operator can now add a tool registration, a note, a bookmark or a
  // setting. Still true is that nothing executes -- there is no agent runtime
  // here yet, and the tables recording runs, approvals and memory are refused a
  // form precisely so nothing can fabricate evidence of a run that never
  // happened.
  //
  // The second line is the one that will still mean something after a runtime
  // exists. "No runtime" is a fact about today; "these seven categories need a
  // person" is the rule that has to survive the day it changes.
  console.log(`Agent foundation verified as approval-gated with no runtime: ${DATABASE_TABLE_GROUPS.agentsAndAutomation.length} tables; records of runs, approvals and memory are read-only, schedules can start work but cannot approve it, and no gated action executes without an approval record.`);
  console.log(`Agent approval rule verified: ${agentAuthority.SENSITIVE_CATEGORY_NAMES.length} categories require owner approval, ${agentAuthority.SELF_SERVE_ACTIONS.length} actions may run unattended, and anything unrecognised goes to the owner.`);
  console.log(`Agent limits verified: an unattended agent is held after ${agentLimits.MAX_UNATTENDED_RUNS_PER_WINDOW} runs in ${agentLimits.LIMIT_WINDOW_MINUTES} minutes or ${agentLimits.MAX_UNATTENDED_RUNS_PER_ACTION_PER_WINDOW} of one action, failures stop counting against it after ${agentAuthority.BREAKER_RECENCY_DAYS} days, and neither the cap nor the breaker can relax a gated action.`);
}

function verifyExtension(tables, sql, label) {
  for (const table of tables) {
    const createPattern = new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+public\\.${table}\\b`, "i");
    const rlsPattern = new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`, "i");
    if (!createPattern.test(sql)) fail(`${label} extension does not create public.${table}`);
    if (!rlsPattern.test(sql) && !sql.includes(`'${table}'`)) fail(`${label} extension does not enable or programmatically verify RLS for public.${table}`);
  }
}
