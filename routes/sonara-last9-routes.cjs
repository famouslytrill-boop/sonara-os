"use strict";

const quoteConversion = require("../lib/sonara-quote-conversion.cjs");
const {
  ALL_OWNER_PAGES,
  childrenOf,
  CREATOR_RECORD_PAGES,
  REFERENCE_SOURCES,
  money,
  pageForApi
} = require("../lib/sonara-owner-record-pages.cjs");
const { locationAllowance, locationLimitMessage } = require("../lib/sonara-plan-limits.cjs");
const { buildCalendarInvite, buildCalendarFeed } = require("../lib/sonara-calendar-invite.cjs");
const { buildRecordCsv } = require("../lib/sonara-record-csv.cjs");
const {
  ACCOUNTING_EXPORT_TYPES,
  REFUSED_EXPORT_TYPES,
  exportSourceFor
} = require("../lib/sonara-accounting-export-sources.cjs");
const { buildContactCard, buildContactBook } = require("../lib/sonara-contact-card.cjs");
const { renderInvoicePdf } = require("../lib/sonara-invoice-pdf.cjs");
const { settle } = require("../lib/sonara-invoice-settlement.cjs");
const { GROWTH_RECORD_PAGES } = require("../lib/sonara-growth-record-pages.cjs");
const { GROWTH_TABLES } = require("../lib/sonara-growth-tables.cjs");
const plainLanguage = require("../lib/sonara-plain-language.cjs");
const { finiteNumber, downloadsOf } = require("../lib/sonara-owner-record-pages.cjs");
const recordStatus = require("../lib/sonara-record-status.cjs");
const recordEdit = require("../lib/sonara-record-edit.cjs");
const changeLog = require("../lib/sonara-record-change-log.cjs");
const recordFilter = require("../lib/sonara-record-filter.cjs");
const recordArchive = require("../lib/sonara-record-archive.cjs");
const { announcePayment } = require("../lib/sonara-invoice-paid-notice.cjs");
const { reduce: reducePosition, MODES: LOCATION_PRIVACY_MODES, DEFAULT_MODE: LOCATION_PRECISION_DEFAULT } = require("../public/sonara-location-precision.js");

// `person` names the column that records who created the row, and it is here
// because leaving it implicit broke every form on these pages.
//
// The insert used to end with `user_id: org.userId || null` for all of them.
// Seventeen of these nineteen tables have no user_id column, and PostgREST
// rejects an insert naming a column that is not there -- so a customer filling
// in a location, a service, a booking, an inventory item or a vendor was
// redirected back to the page with ?problem= and nothing saved. Every stub in
// the suite accepted the payload, so nothing objected.
//
// Where a table does record a person it is under its own name: created_by on
// vendor invoices, logged_by on waste. Those are filled in now rather than
// left null. Where a table records nobody, `person` is omitted and the insert
// names no such column. tests/owner-record-inserts.test.js checks every entry
// below against lib/sonara-migration-columns.cjs, so a wrong name here fails
// rather than shipping as a form that silently will not save.
const RESOURCE_MAP = {
  "/api/business/locations": { table: "business_locations", required: ["name"], defaults: { location_type: "storefront", status: "active" }, planLimit: "locations" },
  "/api/business/services": { table: "business_service_catalog", required: ["name"], defaults: { status: "active" } },
  "/api/business/bookings": { table: "business_bookings", required: ["customer_name"], defaults: { status: "requested" } },
  "/api/business/staff": { table: "business_employee_profiles", required: ["display_name"], person: "user_id", defaults: { status: "active", employment_type: "employee" } },
  "/api/business/schedules": { table: "employee_schedules", required: ["employee_id", "starts_at", "ends_at"], defaults: { status: "scheduled" } },
  "/api/business/vendors": { table: "vendor_accounts", required: ["name"], defaults: { status: "active" } },
  "/api/business/invoices": { table: "vendor_invoices", required: ["vendor_id"], person: "created_by", defaults: { processing_status: "draft", payment_status: "unpaid" } },
  "/api/business/inventory": { table: "inventory_items", required: ["name"], defaults: { status: "active", unit: "each" } },
  "/api/business/recipes": { table: "recipe_cards", required: ["name"], defaults: { status: "active" } },
  "/api/business/menu-items": { table: "menu_items", required: ["name"], defaults: { status: "active", currency: "usd" } },
  "/api/business/sales-summaries": { table: "pos_sales_summaries", required: ["business_date"], defaults: { source: "manual" } },
  "/api/business/vehicles": { table: "vehicle_records", required: ["vehicle_type"], defaults: { status: "active" } },
  "/api/business/maintenance": { table: "maintenance_logs", required: ["description"], defaults: { status: "completed", currency: "usd" } },
  "/api/business/waste": { table: "waste_logs", required: ["item_name"], person: "logged_by", defaults: {} },
  "/api/creator/music-projects": { table: "music_projects", required: ["title"], person: "user_id", defaults: { status: "draft", project_type: "song" } },
  // The artist system. creator_artist_profiles records who set it up; the four
  // below hang off it and record nobody, because migration 016 gives them no
  // user column and inventing one here would fail the insert.
  //
  // artist_profile_id is required on all four. It is nullable in the schema, so
  // the database would take a row without one -- and that row would be
  // invisible on every page, because each page lists by organization and the
  // record belongs to no artist. Refusing here is cheaper than orphan rows.
  "/api/creator/artists": { table: "creator_artist_profiles", required: ["artist_name", "artist_key"], person: "user_id", defaults: { status: "active" } },
  "/api/creator/sound-identity": { table: "creator_sonic_profiles", required: ["artist_profile_id", "name", "profile_key"], defaults: { status: "active" } },
  "/api/creator/album-cycles": { table: "creator_album_cycles", required: ["artist_profile_id", "title", "slug"], defaults: { project_type: "album", release_status: "planning" } },
  "/api/creator/prompt-blueprints": { table: "creator_prompt_blueprints", required: ["artist_profile_id", "name", "blueprint_key", "prompt_template"], defaults: { status: "active" } },
  "/api/creator/video-treatments": { table: "creator_video_treatments", required: ["artist_profile_id", "title"], defaults: { status: "draft", platform_target: "social" } },
  // "queued" was the default and nothing consumes this table: grep finds the
  // insert above, the tenant-scoped list, and no runner. "Queued" states that
  // something is waiting to be processed, so every row written here claimed a
  // worker that does not exist -- the same shape as accounting_exports, which
  // said "whether each one finished" about a file nothing produced.
  //
  // manual_required is already in the schema's check constraint and is true: a
  // person has to do this. One word, no migration, and the row stops promising.
  "/api/integrations/jobs": { table: "integration_jobs", required: ["provider_key", "job_type"], person: "created_by", defaults: { status: "manual_required" } },
  // The four toggles are defaulted off here, and the reason is a rule rather
  // than a preference. AGENTS.md: "Sounds, voice announcements, haptics, SMS,
  // push, and email alerts must be off or explicitly user-controlled by
  // default." Migration 015 gives sound_enabled and vibration_enabled a column
  // default of true, so a row created without an answer was born with both on
  // -- harmless only because nothing reads this table, which is not a reason to
  // leave it. The form asks all four explicitly; these cover a request that
  // does not.
  "/api/sensory/profiles": { table: "sensory_feedback_profiles", required: ["name", "profile_key"], defaults: { status: "active", sound_enabled: false, vibration_enabled: false, motion_enabled: false, location_enabled: false } },
  "/api/sensory/sound-cues": { table: "sound_cues", required: ["cue_key", "name", "event_name"], defaults: { status: "active", sound_type: "tone" } },
  "/api/sensory/haptic-patterns": { table: "haptic_patterns", required: ["pattern_key", "name", "event_name"], defaults: { status: "active" } },
  "/api/location/zones": { table: "location_zones", required: ["name"], defaults: { status: "active", zone_type: "business" } },
  // The three operations workspaces. Each parent table records who raised the
  // row; the lines tables under them are not resources here, because a line
  // detached from its order or count is an orphaned row.
  "/api/business/purchase-orders": { table: "purchase_orders", required: [], person: "created_by", defaults: { status: "draft", currency: "usd" } },
  "/api/business/stock-counts": { table: "inventory_count_sessions", required: [], person: "counted_by", defaults: { status: "draft" } },
  "/api/business/transfers": { table: "location_transfers", required: [], person: "created_by", defaults: { status: "draft" } },
  // Supplier payments and accounting exports. bill_payment_records records no
  // person; accounting_exports has created_by.
  "/api/business/bill-payments": { table: "bill_payment_records", required: [], defaults: { status: "scheduled", currency: "usd" } },
  // Accounts receivable. customer_invoices records who raised it; the payments
  // under it are reached through the invoice, the same way invoice lines are.
  "/api/business/customers": { table: "customers", required: ["name"], person: "created_by", defaults: { status: "active" } },
  "/api/business/quotes": { table: "quotes", required: ["title"], person: "created_by", defaults: { status: "draft" } },
  "/api/business/receivables": { table: "customer_invoices", required: ["customer_id"], person: "created_by", defaults: { status: "draft", currency: "usd" } },
  "/api/business/accounting-exports": { table: "accounting_exports", required: [], person: "created_by", defaults: { status: "queued", export_type: "bills" } },
  // The product catalogue. Status defaults to draft rather than active on
  // purpose: a product with no versions has no price, so listing it as on sale
  // the moment it is created would be the page claiming something it cannot
  // support. The versions under it are reached through the product, the same
  // way invoice lines are reached through the invoice.
  "/api/business/merchant-products": { table: "merchant_products", required: ["name"], person: "created_by", defaults: { status: "draft" } },
  // Sources a business may research. permission_status defaults to needs_review
  // rather than approved, because a row created without an answer has not been
  // ruled on -- and the fetch endpoint treats "not ruled on" as "do not fetch".
  "/api/business/research-sources": { table: "research_sources", required: ["source_url", "source_type"], person: "created_by", defaults: { permission_status: "needs_review", crawl_status: "disabled" } }
};

const PUBLIC_GETS = new Map([
  ["/api/integrations/providers", { table: "integration_providers", query: "?select=provider_key,name,category,connection_mode,capabilities,status&order=category.asc,provider_key.asc&limit=200" }]
]);

// The dashboard. The fourteen pages under it are described in
// lib/sonara-owner-record-pages.cjs, which is also where the reason they
// needed rewriting is recorded.
const OWNER_PAGES = [
  ["/business-builder/owner", "Owner Dashboard", "Run the business workspace: customers, quotes, invoices and what you are owed, plus locations, staff, services, bookings, inventory, vendors, food costs, vehicles, and maintenance."]
];

// The staff portal.
//
// The owner area can now add people, shifts, time entries and tasks. These are
// the pages the people themselves see, and until now every one of them rendered
// three cards explaining what it would show.
//
// The boundary here is one level in from the tenant one. An organization filter
// is not enough: a colleague is inside the same organization. Shifts, time
// entries and tasks belong to one person, so they are scoped by that person's
// employee record, and a signed-in user who has no employee record sees nothing
// rather than everything. Announcements are the exception -- they are addressed
// to the business, so they are scoped by organization on purpose.
const STAFF_PAGES = [
  ["/staff", "Staff Portal", "Your shifts, hours, tasks and updates from whoever runs your workplace."],
  ["/staff/schedule", "My Schedule", "When you are working and where."],
  ["/staff/time", "My Time", "Hours you have recorded."],
  ["/staff/tasks", "My Tasks", "What has been assigned to you."],
  ["/staff/announcements", "Announcements", "Updates from whoever runs your workplace."],
  ["/staff/location", "My Location", "Check-ins you have recorded for job sites, routes and deliveries."]
];

// Customer-designed record types, registered from here rather than from
// server.js.
//
// They are the same product area -- everything below serves
// /business-builder/owner/* and this module already receives every dependency
// they need -- and server.js is under a line ratchet in
// tests/server-split.test.js whose whole point is that behaviour leaves it
// rather than arriving. Four more lines there to reach a module that belongs
// beside these ones would have been four lines in the wrong direction.
// Exactly the values location_events.event_type allows, from migration 015.
// Kept as a list here because the alternative is finding out from a Postgres
// check-constraint error at the moment somebody records a check-in.
const LOCATION_EVENT_TYPES = Object.freeze([
  "check_in", "check_out", "zone_enter", "zone_exit",
  "position_update", "delivery_stop", "job_site_arrival", "job_site_departure", "manual"
]);

const registerSubAppRoutes = require("./sonara-sub-app-routes.cjs");
// Calling a customer is NOT registered from here, and the attempt is worth
// recording. /business-builder/owner/customers/:recordId/call sits beside
// /contact, which this file serves, so registering it here looked right.
//
// It broke nine tests at once. This module accepts a partial dependency object
// on purpose -- `deps.requireCustomer || passthrough`, and so on -- so a test
// can build it with three helpers and exercise one page. The call module
// refuses to register without all nine of its own, which is the stricter and
// better contract, and hanging it off this one silently imposed that contract
// on every existing caller.
//
// The two are not reconcilable by loosening either: a call module that
// registered without getEnv would render a call page that cannot read the ICE
// configuration, which is the failure it exists to report. So it is wired in
// server.js like every other feature, and the line ceiling in
// tests/server-split.test.js moved by two with the reason recorded there.

module.exports = function registerLastNineHoursRoutes(app, deps = {}) {
  registerSubAppRoutes(app, deps);

  const ui = buildUi(deps);
  const requireCustomer = deps.requireCustomer || passthrough;
  const requireBusinessManager = deps.requireBusinessManager || requireCustomer;
  const requireWorkspaceAccess = typeof deps.requireWorkspaceAccess === "function" ? deps.requireWorkspaceAccess : () => requireCustomer;

  registerVerticalTemplates(app, deps, ui);

  // A booking, as a file the business's own calendar will open.
  //
  // business_bookings had starts_at and ends_at and nothing turned either into
  // a calendar entry, so a business could take a booking and still have to
  // retype it into whatever they actually use. That is the one thing a booking
  // is for, and every product this one competes with does it.
  //
  // Deliberately a download rather than an invitation email. Sending mail is a
  // customer campaign under AGENTS.md and needs owner approval; handing
  // somebody a file they asked for is neither.
  app.get("/business-builder/owner/bookings/:recordId/calendar", requireBusinessManager, async (req, res) => {
    const config = getConfig(deps);
    const org = await resolveOrganization(req, deps);
    const recordId = String(req.params.recordId || "");

    // Each refusal says which one it is. A download that silently produces an
    // empty file is the failure this whole module was written against.
    if (!isUuid(recordId)) return res.status(404).type("text").send("That booking reference is not one of ours.");
    if (!config.ok) return res.status(503).type("text").send("Your account database is not connected yet, so this booking cannot be read.");
    if (!org.ok) return res.status(503).type("text").send("We could not tell which business you are signed in to. Sign in again and this will work.");

    // Scoped by organization as well as by id: the service key bypasses row
    // level security, so without the organization filter a guessed id from
    // another business would download.
    const found = await supabaseList(
      config,
      "business_bookings",
      `?select=*&id=eq.${encodeURIComponent(recordId)}&organization_id=eq.${encodeURIComponent(org.organizationId)}&limit=1`
    );
    // A read that failed and a booking that is not there are different things,
    // and answering 404 to both would tell a business their booking is gone
    // during an outage.
    if (!found.ok) return res.status(503).type("text").send("We could not read that booking just now. Nothing has changed; try again shortly.");
    const booking = found.rows[0];
    if (!booking) return res.status(404).type("text").send("That booking is not in your business, or it has been removed.");

    // No business name is passed, and that is deliberate rather than an
    // omission: resolveOrganization returns { ok, organizationId, userId } and
    // nothing else, so `org.organizationName` would be undefined and the
    // summary would silently lose it. Reading a field that does not exist is
    // how a line of code comes to look wired up while doing nothing.
    const invite = buildCalendarInvite(booking, { now: new Date() });
    // 422 rather than 500: the row is readable and the request is well formed,
    // and what is wrong is the booking itself. The message names the field.
    if (!invite.ok) return res.status(422).type("text").send(invite.message);

    res.setHeader("Content-Type", invite.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${invite.filename}"`);
    // A calendar file is a snapshot of a row that can change.
    res.setHeader("Cache-Control", "no-store");
    return res.send(invite.body);
  });

  // Customers as contact cards.
  //
  // The third record type to get a file somebody else's software opens, after
  // bookings became calendar entries and accounting exports became CSV. A grep
  // for VCARD across server.js, lib/ and routes/ found nothing before this, so
  // "Customer & Enquiry Tracker" -- a paid product -- could hold a customer's
  // number and offer no way to get it into the phone you would ring them from.
  //
  // The whole list first, so the static path is matched before the :recordId
  // route below could take "contacts" for an identifier. Declared in this order
  // deliberately rather than by luck.
  app.get("/business-builder/owner/customers/contacts", requireBusinessManager, async (req, res) => {
    const config = getConfig(deps);
    const org = await resolveOrganization(req, deps);
    if (!config.ok) return res.status(503).type("text").send("Your account database is not connected yet, so there are no customers to read.");
    if (!org.ok) return res.status(503).type("text").send("We could not tell which business you are signed in to. Sign in again and this will work.");

    const found = await supabaseList(
      config,
      "customers",
      `?select=*&organization_id=eq.${encodeURIComponent(org.organizationId)}&order=name.asc&limit=2000`
    );
    // `found.ok ? found.rows : []` would hand back an empty address book during
    // an outage, which reads as a business with no customers.
    if (!found.ok) return res.status(503).type("text").send("We could not read your customers just now. Nothing has changed; try again shortly.");

    const book = buildContactBook(found.rows, { now: new Date() });
    if (!book.ok) return res.status(503).type("text").send(book.message);

    res.setHeader("Content-Type", book.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${book.filename}"`);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Sonara-Contacts-Included", String(book.included));
    // Said out loud. A customer with no email and no phone cannot become a
    // contact, and an address book quietly missing nine people is one the
    // business has no way to notice is short.
    if (book.skipped.length) res.setHeader("X-Sonara-Contacts-Skipped", String(book.skipped.length));
    return res.send(book.body);
  });

  app.get("/business-builder/owner/customers/:recordId/contact", requireBusinessManager, async (req, res) => {
    const config = getConfig(deps);
    const org = await resolveOrganization(req, deps);
    const recordId = String(req.params.recordId || "");
    if (!isUuid(recordId)) return res.status(404).type("text").send("That customer reference is not one of ours.");
    if (!config.ok) return res.status(503).type("text").send("Your account database is not connected yet, so this customer cannot be read.");
    if (!org.ok) return res.status(503).type("text").send("We could not tell which business you are signed in to. Sign in again and this will work.");

    // Scoped by organization as well as by id: the service key bypasses row
    // level security, so without the organization filter a guessed id from
    // another business would download.
    const found = await supabaseList(
      config,
      "customers",
      `?select=*&id=eq.${encodeURIComponent(recordId)}&organization_id=eq.${encodeURIComponent(org.organizationId)}&limit=1`
    );
    if (!found.ok) return res.status(503).type("text").send("We could not read that customer just now. Nothing has changed; try again shortly.");
    const customer = found.rows[0];
    if (!customer) return res.status(404).type("text").send("That customer is not in your business, or they have been removed.");

    const card = buildContactCard(customer, {});
    // 422 rather than 500: the row is readable and the request is well formed,
    // and what is missing is a way to reach the person. The message names it.
    if (!card.ok) return res.status(422).type("text").send(card.message);

    res.setHeader("Content-Type", card.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${card.filename}"`);
    res.setHeader("Cache-Control", "no-store");
    return res.send(card.body);
  });

  // An invoice as a file the business can send or file.
  //
  // The same document the customer gets from a shared link, built by the same
  // renderer, so the two cannot disagree about what an invoice says. Scoped by
  // organization as well as by id, like every other per-record download here:
  // the service key bypasses row level security, so without that filter a
  // guessed id from another business would download.
  app.get("/business-builder/owner/invoices/:recordId/pdf", requireBusinessManager, async (req, res) => {
    const config = getConfig(deps);
    const org = await resolveOrganization(req, deps);
    const recordId = String(req.params.recordId || "");
    if (!isUuid(recordId)) return res.status(404).type("text").send("That invoice reference is not one of ours.");
    if (!config.ok) return res.status(503).type("text").send("Your account database is not connected yet, so this invoice cannot be read.");
    if (!org.ok) return res.status(503).type("text").send("We could not tell which business you are signed in to. Sign in again and this will work.");

    const scope = `id=eq.${encodeURIComponent(recordId)}&organization_id=eq.${encodeURIComponent(org.organizationId)}`;
    const found = await supabaseList(config, "customer_invoices", `?select=*&${scope}&limit=1`);
    if (!found.ok) return res.status(503).type("text").send("We could not read that invoice just now. Nothing has changed; try again shortly.");
    const invoice = found.rows[0];
    if (!invoice) return res.status(404).type("text").send("That invoice is not in your business, or it has been removed.");

    const [lines, paid, organization] = await Promise.all([
      supabaseList(config, "customer_invoice_lines",
        `?select=*&invoice_id=eq.${encodeURIComponent(recordId)}&organization_id=eq.${encodeURIComponent(org.organizationId)}&order=created_at.asc`),
      supabaseList(config, "customer_invoice_payments",
        `?select=amount_cents&invoice_id=eq.${encodeURIComponent(recordId)}&organization_id=eq.${encodeURIComponent(org.organizationId)}`),
      supabaseList(config, "organizations", `?select=name&id=eq.${encodeURIComponent(org.organizationId)}&limit=1`)
    ]);
    // A failed line read is not an invoice with no lines on it. Sending a
    // document that says "no lines" when there are some is worse than not
    // sending one, because the business forwards it to their customer.
    if (!lines.ok) return res.status(503).type("text").send("We could not read the lines on that invoice, so the file would have been wrong. Nothing was produced.");

    // `paymentsRead: paid.ok` carries a failed read through as "not known"
    // rather than as "nothing paid".
    const settlement = settle({ invoice, payments: paid.rows, paymentsRead: paid.ok });

    const pdf = renderInvoicePdf({
      business: { name: organization.ok ? (organization.rows[0]?.name || "") : "" },
      invoice,
      lines: lines.rows,
      settlement
    });

    const number = String(invoice.invoice_number || "").replace(/[^A-Za-z0-9._-]/g, "");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="invoice-${number || recordId}.pdf"`);
    res.setHeader("Cache-Control", "no-store");
    return res.send(pdf);
  });

  // An accounting export as a file, because until now it was only ever a row.
  //
  // accounting_exports carries export_type, a period, a status and a file_url.
  // Nothing wrote file_url, nothing moved status past "queued", and there was no
  // CSV anywhere in this repository -- so /business-builder/owner/accounting-exports
  // listed "Queued" under a column headed "whether each one finished", and the
  // answer could never change. A page reporting the state of a job nothing runs.
  //
  // The file is built when it is asked for rather than queued and stored. There
  // is no worker here, and a status that only a worker could advance is how the
  // lie got written in the first place.
  //
  // Which types have a source, and the reason the others do not, both live in
  // lib/sonara-accounting-export-sources.cjs -- the same table the form on the
  // page reads its options from, so the page cannot offer a type this route
  // would then refuse.

  app.get("/business-builder/owner/accounting-exports/:recordId/download", requireBusinessManager, async (req, res) => {
    const config = getConfig(deps);
    const org = await resolveOrganization(req, deps);
    const recordId = String(req.params.recordId || "");
    if (!isUuid(recordId)) return res.status(404).type("text").send("That export reference is not one of ours.");
    if (!config.ok) return res.status(503).type("text").send("Your account database is not connected yet, so this export cannot be built.");
    if (!org.ok) return res.status(503).type("text").send("We could not tell which business you are signed in to. Sign in again and this will work.");

    const found = await supabaseList(
      config,
      "accounting_exports",
      `?select=*&id=eq.${encodeURIComponent(recordId)}&organization_id=eq.${encodeURIComponent(org.organizationId)}&limit=1`
    );
    if (!found.ok) return res.status(503).type("text").send("We could not read that export just now. Nothing has changed; try again shortly.");
    const record = found.rows[0];
    if (!record) return res.status(404).type("text").send("That export is not in your business, or it has been removed.");

    const source = exportSourceFor(record.export_type);
    if (!source) {
      // Named, not generic. "Not supported" tells somebody nothing about
      // whether to wait for it.
      // A row can still carry one of these: the form offered them until 2
      // September 2026, and narrowing the form does not rewrite history.
      const reason = REFUSED_EXPORT_TYPES[String(record.export_type || "")]
        || "That export type names nothing this system can read.";
      return res.status(422).type("text").send(
        `A file for "${String(record.export_type || "unknown")}" exports is not built. ${reason} Producing one from guesses would put wrong figures in front of your accountant. ` +
          `These do download: ${ACCOUNTING_EXPORT_TYPES.join(", ")}.`
      );
    }

    // The period bounds the rows. A missing bound means that side is open, which
    // is a real request and not an error.
    const filters = [`organization_id=eq.${encodeURIComponent(org.organizationId)}`];
    if (record.period_start) filters.push(`${source.dateColumn}=gte.${encodeURIComponent(record.period_start)}`);
    if (record.period_end) filters.push(`${source.dateColumn}=lte.${encodeURIComponent(`${record.period_end}T23:59:59.999Z`)}`);
    const rows = await supabaseList(config, source.table, `?select=*&${filters.join("&")}&order=${source.dateColumn}.asc&limit=10000`);
    // `rows.ok ? rows.rows : []` here would hand an accountant an empty file for
    // a period that has records in it.
    if (!rows.ok) return res.status(503).type("text").send("We could not read the records for that period. Nothing has changed, and no file was made; try again shortly.");

    const csv = buildRecordCsv(rows.rows, source.columns);
    if (!csv.ok) return res.status(503).type("text").send(csv.message);

    const period = `${record.period_start || "start"}-to-${record.period_end || "now"}`.replace(/[^a-zA-Z0-9-]/g, "");
    res.setHeader("Content-Type", csv.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${String(record.export_type)}-${period}.csv"`);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Sonara-Export-Rows", String(csv.rowCount));
    // Said out loud. A value that would otherwise be executed as a formula by a
    // spreadsheet is prefixed with an apostrophe, and that changes it, so the
    // customer is told how many rather than left to find out.
    if (csv.neutralised) res.setHeader("X-Sonara-Export-Values-Altered", String(csv.neutralised));
    return res.send(csv.body);
  });

  // The diary, not one appointment.
  //
  // Registered before the :recordId route above would ever be reached for this
  // path -- Express matches in registration order and "calendar" is not a uuid,
  // so isUuid would have refused it -- but ordering by accident is not ordering,
  // and this is declared first on purpose.
  app.get("/business-builder/owner/bookings/calendar", requireBusinessManager, async (req, res) => {
    const config = getConfig(deps);
    const org = await resolveOrganization(req, deps);
    if (!config.ok) return res.status(503).type("text").send("Your account database is not connected yet, so there are no bookings to read.");
    if (!org.ok) return res.status(503).type("text").send("We could not tell which business you are signed in to. Sign in again and this will work.");

    const found = await supabaseList(
      config,
      "business_bookings",
      `?select=*&organization_id=eq.${encodeURIComponent(org.organizationId)}&order=starts_at.asc&limit=500`
    );
    // `found.ok ? found.rows : []` here would hand back an empty but perfectly
    // valid calendar during an outage, and the business would read it as having
    // no bookings.
    if (!found.ok) return res.status(503).type("text").send("We could not read your bookings just now. Nothing has changed; try again shortly.");

    const feed = buildCalendarFeed(found.rows, { now: new Date() });
    if (!feed.ok) return res.status(503).type("text").send(feed.message);

    res.setHeader("Content-Type", feed.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${feed.filename}"`);
    res.setHeader("Cache-Control", "no-store");
    // Said out loud rather than dropped. A diary missing three appointments
    // because they have no end time is incomplete, and a header is the only
    // place to say so on a file download.
    if (feed.skipped.length) {
      res.setHeader("X-Sonara-Bookings-Skipped", String(feed.skipped.length));
    }
    return res.send(feed.body);
  });

  OWNER_PAGES.forEach(([path, title, body]) => {
    app.get(path, requireBusinessManager, async (req, res) => {
      const org = await resolveOrganization(req, deps);
      const summary = await operationsSummary(getConfig(deps), org.ok ? org.organizationId : null);
      return res.status(200).type("html").send(ui.layout({
        title,
        eyebrow: "Business Builder operations",
        heading: title,
        body,
        sections: [
          ui.card("Your own records", "Everything here belongs to your business and is only visible to you and the people you give access to. If something has not been set up yet, the page says so rather than showing a number it made up."),
          ui.card("You decide who sees what", "Owners and managers control staff access, locations, services, invoices, inventory, vehicles, and day-to-day operations."),
          ...summary.map((item) => ui.card(item.label, item.value))
        ],
        // Every owner record page, generated from the same list that defines
        // them.
        //
        // This was eleven hand-written links, and it had fallen eleven pages
        // behind: purchase orders, stock counts, transfers, supplier payments,
        // accounting exports, costs, maintenance, menu, recipes, vehicles and
        // vendors were all registered, rendering, and reachable only by typing
        // the URL. Adding the money pages by hand fixed five and left those.
        //
        // A hand-kept list of pages next to the list that defines the pages is
        // a list that falls behind. This one cannot.
        actions: [
          // First, because it is the only one that tells the owner something
          // they did not already know they were looking for.
          ui.link("/search", "Search your records"),
          ui.link("/business-builder/owner/assistant", "What needs attention"),
          ui.link("/business-builder/owner/money-due", "Money due in and out"),
          ui.link("/business-builder/owner/chase-drafts", "Chase drafts"),
          ...ALL_OWNER_PAGES.map((ownerPage) => ui.link(ownerPage.path, ownerPage.title)),
          ui.link("/business-builder/dashboard", "Dashboard")
        ]
      }));
    });
  });

  // The fourteen owner record pages: the customer's own records, and a form to
  // add one. Before this they rendered a description of themselves and nothing
  // else, while the API behind them already worked.
  ALL_OWNER_PAGES.forEach((page) => {
    app.get(page.path, requireBusinessManager, async (req, res) => {
      const config = getConfig(deps);
      const org = await resolveOrganization(req, deps);
      let rows = [];
      let references = {};
      let loaded = null;
      let unavailable = null;
      // What this page is filtering by, if anything. Read before the query
      // because the read, the count and the pager all have to agree about it.
      const wanted = recordFilter.termFrom(req.query.q);
      const showingArchived = recordArchive.showingArchived(req.query.archived);
      // Counted separately rather than inferred from the rows on screen: the
      // page is a hundred rows of a longer list, so "how many did we hide" is
      // not a number this page's own result can answer.
      let archivedCount = null;
      if (!config.ok) unavailable = "Your account database is not connected yet, so there is nothing to show.";
      else if (!org.ok) unavailable = "We could not tell which business you are signed in to. Sign in again and this will fill up.";
      else {
        const listed = await listRecordPage(
          config,
          page.table,
          org.organizationId,
          "created_at.desc",
          recordArchive.selectWith(page, page.select || "*"),
          pageNumber(req.query.page),
          `${recordFilter.clauseFor(page, wanted.term)}${recordArchive.hiddenClause(page, { including: showingArchived })}`
        );
        if (!listed.ok) unavailable = "This part of your account has not been set up yet.";
        else { rows = listed.rows; loaded = listed; }
        references = await loadReferences(config, org.organizationId, page);
        if (recordArchive.canArchive(page) && !showingArchived) {
          const counted = await supabaseCount(config, page.table, org.organizationId, "&archived_at=not.is.null");
          // Left null when the count did not happen. Saying "nothing is
          // archived" on the strength of a failed request is how somebody
          // concludes a record they archived has been deleted.
          archivedCount = counted.ok ? counted.count : null;
        }
      }
      // What the last status change did, for the pages whose control is in the
      // row. The change is a POST that redirects, so without this it looks
      // exactly like a page reload -- including the case that matters most,
      // where the record already had the status asked for and nothing changed.
      const statusSaid = String(req.query.status_problem || req.query.status_done || req.query.edited || "").slice(0, 300);
      const sections = unavailable
        ? [ui.card("Not available right now", unavailable)]
        : [
            ...(statusSaid ? [ui.card(req.query.edited ? "Saved" : "Status", statusSaid)] : []),
            filterCard(page, wanted, ui),
            recordsCard(page, rows, ui, loaded, wanted.term, { showingArchived, archivedCount }),
            ...(page.form ? [formCard(page, references, ui)] : [])
          ];
      return res.status(200).type("html").send(ui.layout({
        title: page.title,
        eyebrow: "Business Builder operations",
        heading: page.title,
        body: page.body,
        sections,
        actions: ownerActions(ui, page.path)
      }));
    });

    // Correcting a record.
    //
    // Twenty-six of these pages could create a record and none could change
    // one, so a phone number typed with a digit missing could only be fixed by
    // creating a second customer and leaving the wrong one there. An address
    // book with two entries for the same person, one unreachable, is worse than
    // one with a single wrong entry: now nobody knows which is current.
    //
    // Two routes, and the edit form has a page of its own rather than sitting
    // under the list. Only nine of the twenty-seven pages have a detail page,
    // and a form reachable on nine of them is the gap the status control was
    // just fixed for.
    if (recordEdit.canEdit(page)) {
      app.get(`${page.path}/:recordId/edit`, requireBusinessManager, async (req, res) => {
        const recordId = String(req.params.recordId || "");
        const notFound = (detail) => res.status(404).type("html").send(ui.layout({
          title: page.title,
          eyebrow: "Business Builder operations",
          heading: "Not found",
          body: detail,
          sections: [ui.card("Nothing to correct", "Go back to the list and choose a record from there.")],
          actions: [ui.link(page.path, page.title), ui.link("/business-builder/owner", "Owner Dashboard")]
        }));
        if (!isUuid(recordId)) return notFound("That record reference is not one of ours.");

        const config = getConfig(deps);
        const org = await resolveOrganization(req, deps);
        if (!config.ok) return res.status(503).type("html").send(ui.layout({
          title: page.title,
          eyebrow: "Business Builder operations",
          heading: page.title,
          body: page.body,
          sections: [ui.card("Not available right now", "Your account database is not connected yet, so there is nothing to correct.")],
          actions: [ui.link(page.path, page.title)]
        }));
        if (!org.ok) return res.status(403).type("html").send(ui.layout({
          title: page.title,
          eyebrow: "Business Builder operations",
          heading: page.title,
          body: page.body,
          sections: [ui.card("Not available right now", "We could not tell which business you are signed in to. Sign in again and this will fill up.")],
          actions: [ui.link(page.path, page.title)]
        }));

        // Scoped by organization as well as by id, because the service key
        // bypasses row level security and a guessed id would otherwise open
        // another business's record in an editable form.
        const found = await supabaseList(config, page.table, `?select=*&id=eq.${encodeURIComponent(recordId)}&organization_id=eq.${encodeURIComponent(org.organizationId)}&limit=1`);
        if (!found.ok) return res.status(502).type("html").send(ui.layout({
          title: page.title,
          eyebrow: "Business Builder operations",
          heading: page.title,
          body: page.body,
          // A read that failed is not a record that is missing, and offering an
          // empty form for one would invite somebody to retype a record that is
          // still there and then save the blanks over it.
          sections: [ui.card("Not available right now", "We could not read that record just now. Nothing has been changed.")],
          actions: [ui.link(page.path, page.title)]
        }));
        const row = found.rows[0];
        if (!row) return notFound("That record is not in your business, or it has been removed.");

        const references = await loadReferences(config, org.organizationId, page);
        // Shown here rather than on a page of its own: somebody is on this page
        // because they are about to change something, and "a manager changed the
        // price an hour ago" matters at exactly that moment.
        const history = await changeLog.historyOf(
          (table, query) => supabaseList(config, table, query),
          { organizationId: org.organizationId, table: page.table, recordId }
        );
        return res.status(200).type("html").send(ui.layout({
          title: page.title,
          eyebrow: "Business Builder operations",
          heading: page.title,
          body: page.body,
          sections: [editFormCard(page, row, references, ui, req.query.edit_problem), historyCard(history, ui)],
          actions: [
            ui.link(page.path, `All ${page.title.toLowerCase()}`),
            ui.link("/business-builder/owner", "Owner Dashboard"),
            ui.link("/business-builder/dashboard", "Dashboard")
          ]
        }));
      });

      app.post(`${page.path}/:recordId`, requireBusinessManager, async (req, res) => {
        const recordId = String(req.params.recordId || "");
        const edit = `${page.path}/${encodeURIComponent(recordId)}/edit`;
        const refuse = (status, code, detail) => {
          if (!acceptsHtml(req)) return res.status(status).json({ ok: false, code, detail });
          return res.redirect(303, `${edit}?edit_problem=${encodeURIComponent(detail || code)}`);
        };
        if (!isUuid(recordId)) return refuse(400, "record_required", "That record reference is not one of ours.");

        const config = getConfig(deps);
        if (!config.ok) return refuse(503, "setup_required", "Your account database is not connected yet.");
        const org = await resolveOrganization(req, deps);
        if (!org.ok) return refuse(403, org.code || "no_organization", "We could not tell which business you are signed in to.");

        // Read first. The previous values are what turn "saved" into a sentence
        // naming what actually changed, and they are also what stops an
        // unchanged field being rewritten over somebody else's edit.
        const found = await supabaseList(config, page.table, `?select=*&id=eq.${encodeURIComponent(recordId)}&organization_id=eq.${encodeURIComponent(org.organizationId)}&limit=1`);
        if (!found.ok) return refuse(502, "unreadable", "We could not read that record just now. Nothing has been changed.");
        const before = found.rows[0];
        if (!before) return refuse(404, "not_yours", "That record is not in your business, or it has been removed.");

        // Built from the page's own field declaration, so a body key the form
        // never declared is not written whatever it is called. That is the
        // point rather than a tidiness: the patch goes out with the service
        // key, and a body carrying organization_id would otherwise be a way to
        // move a record between businesses.
        const wanted = recordEdit.changesFrom(page, req.body, before);
        if (!wanted.ok) return refuse(400, wanted.code, wanted.detail);

        const said = recordEdit.describeEdit(wanted.changed);
        // Nothing differed. Sending an empty PATCH would ask the database to do
        // nothing and then report it as a save.
        if (!wanted.changed.length) {
          if (!acceptsHtml(req)) return res.status(200).json({ ok: true, changed: [], detail: said });
          return res.redirect(303, `${page.path}?edited=${encodeURIComponent(said)}`);
        }

        const saved = await supabasePatchScoped(config, page.table, recordId, org.organizationId, wanted.patch);
        if (!saved.ok) return refuse(502, "unwritable", "That could not be saved, so nothing has been changed.");
        if (!saved.rows.length) return refuse(404, "not_yours", "That record is not in your business, or it has been removed.");

        // The column names rather than the labels, because the log is data and
        // the labels are wording that will be rewritten.
        const logged = await changeLog.record(
          (table, row) => supabaseInsert(config, table, row),
          { organizationId: org.organizationId, table: page.table, recordId, changedBy: org.userId, kind: "fields", fields: Object.keys(wanted.patch) }
        );
        const told = logged.ok ? said : `${said} We could not record who changed it.`;

        if (!acceptsHtml(req)) return res.status(200).json({ ok: true, changed: wanted.changed, detail: told, recorded: logged.ok });
        return res.redirect(303, `${page.path}?edited=${encodeURIComponent(told)}`);
      });
    }

    // Taking a record off the list, and putting it back.
    //
    // Registered only where the page has no terminal status of its own, so no
    // page offers two ways to retire one record. See
    // lib/sonara-record-archive.cjs for why that set is derived rather than
    // written down.
    //
    // This is not a delete and nothing here cascades. AGENTS.md puts
    // destructive data changes behind owner approval; nothing is destroyed, and
    // the owner pressing a button they can see is the owner.
    if (recordArchive.canArchive(page)) {
      app.post(`${page.path}/:recordId/archive`, requireBusinessManager, async (req, res) => {
        const recordId = String(req.params.recordId || "");
        const refuse = (status, code, detail) => {
          if (!acceptsHtml(req)) return res.status(status).json({ ok: false, code, detail });
          return res.redirect(303, `${page.path}?status_problem=${encodeURIComponent(detail || code)}`);
        };
        if (!isUuid(recordId)) return refuse(400, "record_required", "That record reference is not one of ours.");

        const wanted = String(req.body?.archived ?? "") === "1";
        const config = getConfig(deps);
        if (!config.ok) return refuse(503, "setup_required", "Your account database is not connected yet.");
        const org = await resolveOrganization(req, deps);
        if (!org.ok) return refuse(403, org.code || "no_organization", "We could not tell which business you are signed in to.");

        // Scoped by organization on the write as well, for the same reason as
        // every other write on these pages: the service key bypasses row level
        // security, so the filter is the whole tenant boundary.
        const saved = await supabasePatchScoped(config, page.table, recordId, org.organizationId, recordArchive.archivePatch(wanted));
        if (!saved.ok) return refuse(502, "unwritable", "That could not be saved, so nothing has been changed.");
        if (!saved.rows.length) return refuse(404, "not_yours", "That record is not in your business, or it has been removed.");

        const logged = await changeLog.record(
          (table, row) => supabaseInsert(config, table, row),
          { organizationId: org.organizationId, table: page.table, recordId, changedBy: org.userId, kind: "fields", fields: ["archived_at"] }
        );
        const said = logged.ok
          ? recordArchive.describeChange(wanted)
          : `${recordArchive.describeChange(wanted)} We could not record who changed it.`;

        if (!acceptsHtml(req)) return res.status(200).json({ ok: true, archived: wanted, detail: said, recorded: logged.ok });
        return res.redirect(303, `${page.path}?edited=${encodeURIComponent(said)}`);
      });
    }

    // Changing a record's status.
    //
    // Registered only for pages that declare one, so a table with no status
    // gets no endpoint rather than an endpoint that always refuses.
    //
    // Registered here, beside the list page, rather than beside the detail
    // page below: only six of the twenty-seven pages have line items and so
    // only six have a detail page, and the first version of this hung off that
    // loop. Quotes and bookings -- the two records this whole change exists
    // for -- were both among the five that got no endpoint at all. The list
    // page is the one page every record kind has.
    //
    // This is the smallest thing that was missing and the one that mattered
    // most: twenty-seven record pages could create and read, and none could
    // change anything. Eleven of them declare a status, and quote -> invoice is
    // gated on `accepted`, so invoices, payments, settlement, the receivables
    // page and the invoice-paid notification were all downstream of a change
    // nobody could make. Meanwhile lib/sonara-quote-conversion.cjs was telling
    // people to "mark it accepted", and the public booking page was telling
    // strangers the business would confirm their request.
    //
    // The owner acting, not an agent -- the same reading as the quote
    // conversion above. lib/sonara-agent-authority.cjs governs what runs
    // without a person; a person pressing a button they can see is the person.
    if (recordStatus.hasStatus(page)) {
      app.post(`${page.path}/:recordId/status`, requireBusinessManager, async (req, res) => {
        const recordId = String(req.params.recordId || "");
        const back = statusReturnPath(page, recordId);
        const refuse = (status, code, detail) => {
          if (!acceptsHtml(req)) return res.status(status).json({ ok: false, code, detail });
          return res.redirect(303, `${back}?status_problem=${encodeURIComponent(detail || code)}`);
        };

        if (!isUuid(recordId)) return refuse(400, "record_required", "That record reference is not one of ours.");

        // Validated against the page's own declaration before anything is read.
        // A status the database would reject surfaces as a check-constraint
        // violation nobody outside this file can read.
        const wanted = recordStatus.validateStatus(page, req.body?.status);
        if (!wanted.ok) return refuse(400, wanted.code, wanted.detail);

        const config = getConfig(deps);
        if (!config.ok) return refuse(503, "setup_required", "Your account database is not connected yet.");
        const org = await resolveOrganization(req, deps);
        if (!org.ok) return refuse(403, org.code || "no_organization", "We could not tell which business you are signed in to.");

        // Read first, and scoped by organization as well as by id: the service
        // key bypasses row level security, so without the filter a guessed id
        // from another business would be changed. Reading also gives the
        // previous value, which is what makes the confirmation say what
        // actually happened rather than only what was asked for.
        const found = await supabaseList(
          config,
          page.table,
          `?select=id,status&id=eq.${encodeURIComponent(recordId)}&organization_id=eq.${encodeURIComponent(org.organizationId)}&limit=1`
        );
        if (!found.ok) return refuse(502, "unreadable", "We could not read that record just now. Nothing has been changed.");
        const before = found.rows[0];
        if (!before) return refuse(404, "not_yours", "That record is not in your business, or it has been removed.");

        // Scoped by organization on the write as well as on the read above.
        // The read already proved this record belongs to the business, so the
        // second filter changes no outcome today -- it is here because the
        // service key bypasses row level security, and the day somebody moves
        // or shortens that read is the day the only tenant boundary on this
        // write disappears silently. supabasePatch filters on id alone and is
        // shared with callers that do not want an organization column, so this
        // one writes its own request rather than widening that.
        const saved = await supabasePatchScoped(config, page.table, recordId, org.organizationId, { status: wanted.status });
        if (!saved.ok) return refuse(502, "unwritable", "That could not be saved, so the status is unchanged.");

        // A PATCH that matched nothing answers 200 with an empty list. That is
        // not a saved change, and reporting it as one is exactly the shape of
        // lie this codebase keeps finding.
        if (!saved.rows.length) return refuse(404, "not_yours", "That record is not in your business, or it has been removed.");

        // Recorded after the change, because a log entry for a write that did
        // not happen is worse than no entry. See lib/sonara-record-change-log.cjs
        // for why a failed log is said out loud rather than swallowed: a log
        // that silently drops what it could not write reads as complete, and
        // somebody looking for a missing change concludes it never happened.
        const logged = await changeLog.record(
          (table, row) => supabaseInsert(config, table, row),
          { organizationId: org.organizationId, table: page.table, recordId, changedBy: org.userId, kind: "status", fields: ["status"] }
        );
        const said = logged.ok
          ? recordStatus.describeChange(before.status, wanted.status)
          : `${recordStatus.describeChange(before.status, wanted.status)} We could not record who changed it.`;

        if (!acceptsHtml(req)) return res.status(200).json({ ok: true, status: wanted.status, changed: said, recorded: logged.ok });
        return res.redirect(303, `${back}?status_done=${encodeURIComponent(said)}`);
      });
    }
  });

  // The four pages whose records have line items: purchase orders, stock
  // counts, transfers and vendor invoices. A purchase order with no lines is a
  // number with nothing behind it, so the parent page alone was not the
  // feature.
  //
  // Lines are reachable only through their parent. lib/sonara-orphan-tables.cjs
  // classified all four line tables "build-with-parent" for that reason: a
  // standalone "add a line" form would be a way to create rows belonging to
  // nothing.
  ALL_OWNER_PAGES.filter((page) => childrenOf(page).length > 0).forEach((page) => {
    const children = childrenOf(page);
    app.get(`${page.path}/:recordId`, requireBusinessManager, async (req, res) => {
      const config = getConfig(deps);
      const org = await resolveOrganization(req, deps);
      const recordId = String(req.params.recordId || "");
      if (!isUuid(recordId)) return res.status(404).type("html").send(ui.layout({
        title: page.title,
        eyebrow: "Business Builder operations",
        heading: "Not found",
        body: "That record reference is not one of ours.",
        sections: [ui.card("Nothing to show", "Go back to the list and open a record from there.")],
        actions: [ui.link(page.path, page.title), ui.link("/business-builder/owner", "Owner Dashboard")]
      }));

      let parent = null;
      // One entry per child table, in declaration order.
      let childRows = children.map(() => ({ ok: false, rows: [] }));
      let extra = null;
      let references = {};
      let shareLink = null;
      let publishState = null;
      let unavailable = null;
      if (!config.ok) unavailable = "Your account database is not connected yet, so there is nothing to show.";
      else if (!org.ok) unavailable = "We could not tell which business you are signed in to. Sign in again and this will fill up.";
      else {
        // Scoped by organization as well as by id. The service key bypasses row
        // level security, so without the organization filter a guessed id from
        // another business would open.
        const found = await supabaseList(config, page.table, `?select=*&id=eq.${encodeURIComponent(recordId)}&organization_id=eq.${encodeURIComponent(org.organizationId)}&limit=1`);
        parent = found.ok ? found.rows[0] : null;
        if (!parent) unavailable = "That record is not in your business, or it has been removed.";
        else {
          // `listed.ok ? listed.rows : []` was here, and an unreadable list
          // rendered as spec.empty -- "Nothing has been added to this invoice
          // yet" -- for an invoice whose lines could not be read. The customer
          // is told a definite thing about their records on the strength of a
          // request that failed, and the total below it is computed over the
          // same empty array. The outcome travels now.
          childRows = await Promise.all(children.map(async (spec) => {
            const listed = await supabaseList(config, spec.table, `?select=*&${spec.parentColumn}=eq.${encodeURIComponent(recordId)}&organization_id=eq.${encodeURIComponent(org.organizationId)}&order=created_at.asc&limit=200`);
            return listed.ok ? { ok: true, rows: listed.rows } : { ok: false, rows: [] };
          }));

          // Some derived figures need rows this record does not own. The
          // labour cost of a day's trading is the case that forced it: hours
          // are on employee_time_entries and rates on employee_wage_rates, and
          // neither is a child of a sales summary.
          //
          // The reader is handed a scoped list function rather than the
          // Supabase config, so a page cannot write a query that forgets the
          // organization filter -- which is the one mistake that would let one
          // business read another's payroll.
          // The line forms below have pickers of their own. The list handler
          // loads these; the detail handler never did, which is the other half
          // of why a child reference field always rendered empty.
          references = await loadReferences(config, org.organizationId, page);

          // Whether this record is already published, if this kind can be.
          //
          // Three states, and the page renders all three: shared (show the link
          // and the way to stop), not shared (offer to), and **could not tell**.
          // A read that failed is not a record that is private, and offering to
          // publish something that is already public -- or hiding the way to
          // unpublish it -- are both worse than saying the check did not run.
          // The public address of a creator profile, for the page that owns it.
          // Read from the record itself rather than a second table, because the
          // handle IS the publication -- absent means private.
          if (page.publishHandle) {
            publishState = { ok: true, handle: parent?.public_handle || null, publishedBefore: Boolean(parent?.published_at) };
          }

          if (page.shareableAs) {
            const links = await supabaseList(
              config,
              "shared_links",
              `?select=token&organization_id=eq.${encodeURIComponent(org.organizationId)}`
                + `&resource_type=eq.${encodeURIComponent(page.shareableAs)}&resource_id=eq.${encodeURIComponent(recordId)}`
                + "&revoked_at=is.null&limit=1"
            );
            shareLink = links.ok ? { ok: true, token: links.rows[0]?.token || null } : { ok: false, token: null };
          }

          if (typeof page.derivedReads === "function") {
            const scopedList = (table, query = "") =>
              supabaseList(config, table, `?select=*&organization_id=eq.${encodeURIComponent(org.organizationId)}${query}&limit=500`);
            extra = await page.derivedReads(parent, scopedList);
          }
        }
      }

      const sections = unavailable
        ? [ui.card("Not available right now", unavailable)]
        : [
            summaryCard(page, parent, ui),
            ...(page.shareableAs ? [shareCard(page, recordId, shareLink, ui)] : []),
            ...(page.publishHandle ? [publishCard(page, recordId, publishState, ui)] : []),
            ...(typeof page.derivedCard === "function" ? [page.derivedCard(parent, childRows, ui, extra)].filter(Boolean) : []),
            ...(recordStatus.hasStatus(page) && parent ? [statusCard(page, parent, ui, req.query.status_problem, req.query.status_done)] : []),
            ...children.flatMap((spec, index) => [linesCard(spec, childRows[index], ui), lineFormCard(spec, recordId, ui, references)])
          ];

      return res.status(unavailable && !parent && config.ok && org.ok ? 404 : 200).type("html").send(ui.layout({
        title: page.title,
        eyebrow: "Business Builder operations",
        heading: page.title,
        body: children.map((spec) => spec.title).join(" "),
        sections,
        actions: [
          // Only when the record was actually read. Offering a download for a
          // record this page could not find hands somebody a link that answers
          // 404, and the page above it has already said the record is not
          // there -- two answers to the same question, one of them wrong.
          ...(parent ? downloadsOf(page).map((entry) => ui.link(entry.href(recordId), entry.label)) : []),
          ui.link(page.path, `All ${page.title.toLowerCase()}`),
          ui.link("/business-builder/owner", "Owner Dashboard"),
          ui.link("/business-builder/dashboard", "Dashboard")
        ]
      }));
    });

    // Saving a line returns to the record it belongs to, not to a JSON body.
    children.forEach((spec) => {
    app.post(spec.api, requireBusinessManager, async (req, res) => {
      const parentId = String(req.body[spec.parentColumn] || "");
      const back = isUuid(parentId) ? `${page.path}/${parentId}` : page.path;
      const respond = (status, payload) => {
        if (!acceptsHtml(req)) return res.status(status).json(payload);
        if (payload.ok) return res.redirect(303, back);
        return res.redirect(303, `${back}?problem=${encodeURIComponent(payload.code || "not_saved")}`);
      };
      if (!isUuid(parentId)) return respond(400, { ok: false, code: "parent_required" });

      // Required fields come from the child's own form declaration.
      //
      // This read `req.body.item_name` directly, which was true of the four
      // line tables that existed when it was written -- all of them stock lines
      // with an item name. customer_invoice_payments requires an amount and has
      // no item name, so every payment submitted was rejected as
      // missing_required for a field its form never asks for. The form rendered,
      // the button worked, and nothing could ever save.
      const requiredFields = spec.form.fields.filter((field) => field.required).map((field) => field.name);
      const missing = requiredFields.filter((name) => !String(req.body[name] ?? "").trim());
      if (missing.length) return respond(400, { ok: false, code: "missing_required", missing });

      // "Either pick one, or type it out."
      //
      // An invoice line may name a catalogue version instead of carrying a
      // description and a total. Those two fields cannot simply be `required`,
      // because the browser would block the submission before the server could
      // fill anything -- so the rule lives here, where it can be one or the
      // other. Without a reference, every field in the list is required again.
      const reference = spec.requireEither ? String(req.body[spec.requireEither.reference] || "") : "";
      if (spec.requireEither && !isUuid(reference)) {
        const untyped = spec.requireEither.fields.filter((name) => !String(req.body[name] ?? "").trim());
        if (untyped.length) return respond(400, { ok: false, code: "missing_required", missing: untyped });
      }

      const config = getConfig(deps);
      if (!config.ok) return respond(503, { ok: false, code: "setup_required", service: "supabase" });
      const org = await resolveOrganization(req, deps);
      if (!org.ok) return respond(403, org);

      // The parent has to belong to this business before anything is attached
      // to it. Without this check a line could be written into another
      // organization's order by posting its id.
      const owned = await supabaseList(config, page.table, `?select=id&id=eq.${encodeURIComponent(parentId)}&organization_id=eq.${encodeURIComponent(org.organizationId)}&limit=1`);
      if (!owned.ok || !owned.rows.length) return respond(403, { ok: false, code: "parent_not_yours" });

      const submitted = dropBlanks(req.body);
      delete submitted.organization_id;
      delete submitted.user_id;
      delete submitted.id;
      // A child may compute a column rather than ask for it. Recipe ingredient
      // cost is the first: quantity, unit cost and waste are facts a person
      // knows, and the cost is arithmetic over them. Asking for both invites the
      // stored number to disagree with its own inputs.
      //
      // Deliberately unlike an invoice line, where line_total_cents IS asked
      // for and stored -- a line total is what the business decided to charge,
      // and recomputing it would overwrite a discount. Nobody discounts a
      // recipe.
      const derived = typeof spec.derive === "function" ? spec.derive(submitted) : {};

      // What a chosen catalogue version fills in.
      //
      // Scoped by organization as well as by id, for the same reason the parent
      // check above is: the service key bypasses row level security, so a
      // guessed id from another business would otherwise price this line from
      // their catalogue.
      //
      // Only blanks are filled. dropBlanks has already removed anything the
      // person left empty, so `submitted[key] === undefined` is exactly "they
      // did not type this" -- and a typed value is a decision that stands.
      if (spec.fillFrom && isUuid(String(req.body[spec.fillFrom.field] || ""))) {
        const referenceId = String(req.body[spec.fillFrom.field]);
        const found = await supabaseList(
          config,
          spec.fillFrom.table,
          `?select=${encodeURIComponent(spec.fillFrom.select)}&id=eq.${encodeURIComponent(referenceId)}&organization_id=eq.${encodeURIComponent(org.organizationId)}&limit=1`
        );
        // A read that failed is not a reference that does not exist. The first
        // saves a line with no description against a not-null column; the
        // second is somebody else's row. Both refuse, and say which.
        if (!found.ok) return respond(502, { ok: false, code: "catalogue_unreadable" });
        if (!found.rows[0]) return respond(403, { ok: false, code: "reference_not_yours" });
        const values = spec.fillFrom.values(found.rows[0], submitted) || {};
        for (const [key, value] of Object.entries(values)) {
          if (submitted[key] === undefined && value !== null && value !== undefined) submitted[key] = value;
        }
      }

      // Re-checked after filling, against the full list rather than the reduced
      // one. A reference that produced no description would otherwise insert a
      // null into a not-null column and fail as a database error the customer
      // cannot act on.
      if (spec.requireEither) {
        const stillMissing = spec.requireEither.fields.filter((name) => submitted[name] === undefined || submitted[name] === null);
        if (stillMissing.length) return respond(400, { ok: false, code: "missing_required", missing: stillMissing });
      }

      const payload = sanitizeObject({ ...submitted, ...derived, [spec.parentColumn]: parentId, organization_id: org.organizationId });
      const saved = await supabaseInsert(config, spec.table, payload);

      // The one product event this application notifies on.
      //
      // Recording a payment is the only place in the codebase where an invoice
      // can become settled, so it is the only honest place to send
      // "invoice_paid" from. Everything else about push was already built and
      // reachable -- the store, the sender, the service worker, the page that
      // asks permission -- and nothing called notify(), which made the whole
      // set a capability nobody could ever receive.
      //
      // Three deliberate choices, each the opposite of the obvious one:
      //
      //   Awaited, not fired and forgotten. This runs as a serverless function;
      //   execution can be frozen the moment the response is written, and an
      //   un-awaited fetch is a notification that silently never leaves.
      //
      //   Its result is dropped. A push that could not be sent must not turn a
      //   payment that WAS saved into an error on the person's screen. The
      //   money is recorded either way, and that is the fact the page reports.
      //
      //   It cannot throw. announcePayment returns a reason rather than
      //   rejecting, and the try/catch is the second line of that same rule:
      //   the response below is owed to somebody whose payment already landed.
      if (spec.table === "customer_invoice_payments" && saved?.ok !== false) {
        try {
          await announcePayment(pushDeps(config, deps), {
            organizationId: org.organizationId,
            invoiceId: parentId,
            paymentId: saved?.rows?.[0]?.id || null
          });
        } catch { /* a saved payment is not undone by a notification that failed */ }
      }

      return respond(saved?.ok === false ? 502 : 200, saved);
    });
    });
  });

  // Getting your records out, and asking for them to be gone.
  //
  // The product's whole pitch is that a business's records live in one place.
  // "How do I get them out" and "how do I close this and have it gone" are the
  // questions that follow, and neither had an answer: /account offered profile,
  // security, preferences, workspaces, integrations and setup, and nothing else.
  //
  // Cancelling was already possible -- the Stripe billing portal handles it --
  // so a customer could stop paying and still not leave.
  //
  // The two halves are deliberately not symmetrical. Export is immediate,
  // because handing somebody a copy of their own rows is not a decision anybody
  // needs to review. **Erasure is a request, not a button.** AGENTS.md forbids
  // automating destructive data changes without owner approval, and
  // lib/sonara-module-crud.cjs already settled the same question for single
  // records: archive rather than hard-delete, and route genuine erasure through
  // support. An automated wipe of an entire organization is that decision at the
  // largest possible scale, which is the least defensible place to skip review.
  // Everything the product keeps for a customer, from the pages that keep it.
  //
  // This was assembled from two of the three page collections and covered 30
  // tables. It left out **21**: every Growth Studio record — leads, campaigns,
  // consent records, contact history, conversions — and every line item inside
  // a record, including what is on an invoice and what has been paid against
  // it. Meanwhile /legal/terms says "What you put in stays yours. You can
  // export it at any time from your data page."
  //
  // The consent records were the sharpest of those: growth_contact_consents is
  // the proof somebody agreed to be contacted, and a business that leaves
  // without it loses the basis for contacting its own customers.
  //
  // Derived from the page collections rather than listed, so a record type that
  // ships with a page is in the export the same day — and
  // tests/the-export-covers-every-record.test.js fails if one is not.
  const EXPORTABLE = [
    ...ALL_OWNER_PAGES.map((page) => ({ table: page.table, label: page.title })),
    ...ALL_OWNER_PAGES.flatMap((page) => childrenOf(page).map((spec) => ({ table: spec.table, label: spec.title || spec.table }))),
    ...CREATOR_RECORD_PAGES.map((page) => ({ table: page.table, label: page.title })),
    ...GROWTH_RECORD_PAGES.map((page) => ({ table: GROWTH_TABLES[page.tableKey], label: page.title || page.tableKey }))
  ]
    .filter((entry) => entry.table)
    .filter((entry, index, all) => all.findIndex((other) => other.table === entry.table) === index);

  app.get("/account/data", requireCustomer, async (req, res) => {
    const org = await resolveOrganization(req, deps);
    const tables = EXPORTABLE.map((entry) => entry.label).sort();
    return res.status(200).type("html").send(ui.layout({
      title: "Your data",
      eyebrow: "Your account",
      heading: "Your data",
      body: "What is stored, how to take a copy with you, and how to ask for it to be erased.",
      sections: [
        ui.card(
          "What is kept",
          `Your account details, the records you create in each workspace, your support requests, and your billing history. ` +
          `The export below covers ${tables.length} kinds of record: ${tables.join(", ")}.`
        ),
        ui.card(
          "How long it is kept",
          "For as long as the account is open. Deleting a record inside the product archives it rather than removing it, so it can be brought back if it was a mistake -- which means an archived record is still stored. Erasure is the request below."
        ),
        ui.card(
          "Take a copy",
          `A file containing your records as they stand, in JSON. Nothing is left out of the kinds listed above, and nothing is transformed.` +
          `<div class="card-actions"><a class="action" href="/account/data/export">Download a copy of your records</a></div>`
        ),
        ui.card(
          "Ask for erasure",
          `<p>This sends a request. It does not erase anything by itself, and we would rather say that plainly than have a button that quietly does something irreversible on one click.</p>` +
          `<p>A person reviews it, confirms it is really you asking, and tells you what was removed and what has to be kept -- billing records generally have to be retained for tax purposes even after an account closes.</p>` +
          `<form method="post" action="/account/data/erasure-request"><label>Anything we should know<textarea name="note" rows="3" maxlength="1000" placeholder="Optional"></textarea></label><button type="submit">Request erasure of my records</button></form>`
        ),
        ...(org.ok ? [] : [ui.card("Not signed in to a workspace", "Sign in and this page will show the records tied to your business.")])
      ],
      actions: [ui.link("/account", "Account"), ui.link("/support", "Contact support")]
    }));
  });

  app.get("/account/data/export", requireCustomer, async (req, res) => {
    const config = getConfig(deps);
    const org = await resolveOrganization(req, deps);
    if (!config.ok || !org.ok) {
      return res.status(503).json({ ok: false, code: "export_unavailable", reason: "Your workspace could not be read just now. Nothing was exported." });
    }

    // A table that could not be read is named as unreadable rather than left
    // out. An export silently missing a table is the worst version of this:
    // the customer keeps the file believing it is complete.
    const parts = await Promise.all(EXPORTABLE.map(async (entry) => {
      const listed = await supabaseList(config, entry.table, `?select=*&organization_id=eq.${encodeURIComponent(org.organizationId)}&order=created_at.desc&limit=10000`);
      return [entry.table, listed.ok ? listed.rows : null];
    }));

    const unreadable = parts.filter(([, rows]) => rows === null).map(([table]) => table);
    res.setHeader("Content-Disposition", `attachment; filename="sonara-records-${new Date().toISOString().slice(0, 10)}.json"`);
    return res.status(200).json({
      exportedAt: new Date().toISOString(),
      organizationId: org.organizationId,
      complete: unreadable.length === 0,
      unreadable,
      note: unreadable.length
        ? "Some record types could not be read when this file was made. They are listed under `unreadable` and are not missing from your account -- ask support for another copy."
        : "Every record type this export covers was readable.",
      // null, not []. An unreadable table is named in `unreadable` above, but a
      // consumer reading records.customers reads it as the customers — the same
      // "a field called ok is read as ok" mistake one level down. null cannot be
      // mistaken for "you have none", and anything iterating it fails loudly.
      records: Object.fromEntries(parts.map(([table, rows]) => [table, rows]))
    });
  });

  app.post("/account/data/erasure-request", requireCustomer, async (req, res) => {
    const back = "/account/data";
    const respond = (status, payload) => {
      if (!acceptsHtml(req)) return res.status(status).json(payload);
      return res.redirect(303, payload.ok ? `${back}?requested=1` : `${back}?problem=${encodeURIComponent(payload.code || "not_recorded")}`);
    };

    const config = getConfig(deps);
    const org = await resolveOrganization(req, deps);
    if (!config.ok || !org.ok) return respond(503, { ok: false, code: "workspace_unavailable" });

    const note = String(req.body?.note || "").trim().slice(0, 1000);
    const saved = await supabaseInsert(config, "support_requests", {
      organization_id: org.organizationId,
      user_id: org.userId || null,
      subject: "Erasure request",
      // Marked so it cannot be mistaken for an ordinary support ticket in a
      // queue: this one has a clock on it in most jurisdictions.
      message: `The account holder has asked for their records to be erased.${note ? `\n\nThey added: ${note}` : ""}`,
      status: "open"
    });
    if (!saved.ok) return respond(502, { ok: false, code: "not_recorded" });
    return respond(201, { ok: true, recorded: true });
  });

  // Turning a won quote into an invoice.
  //
  // The owner acting, not an agent: lib/sonara-agent-authority.cjs governs what
  // runs without a person, and a person pressing a button they can see is the
  // person. Routing this through the runner would classify the owner's own
  // click as an unrecognised agent action and refuse it.
  app.post("/api/business/quotes/:quoteId/invoice", requireBusinessManager, async (req, res) => {
    const quoteId = String(req.params.quoteId || "");
    const back = "/business-builder/owner/quotes";
    const respond = (status, payload) => {
      if (!acceptsHtml(req)) return res.status(status).json(payload);
      if (payload.ok) return res.redirect(303, `/business-builder/owner/receivables/${payload.invoiceId}`);
      return res.redirect(303, `${back}?problem=${encodeURIComponent(payload.code || "not_converted")}`);
    };

    if (!isUuid(quoteId)) return respond(400, { ok: false, code: "quote_required" });
    const config = getConfig(deps);
    if (!config.ok) return respond(503, { ok: false, code: "setup_required", service: "supabase" });
    const org = await resolveOrganization(req, deps);
    if (!org.ok) return respond(403, org);

    // Scoped by organization as well as by id, because the service key bypasses
    // row level security and a guessed id from another business would otherwise
    // convert.
    const found = await supabaseList(config, "quotes", `?select=*&id=eq.${encodeURIComponent(quoteId)}&organization_id=eq.${encodeURIComponent(org.organizationId)}&limit=1`);
    const quote = found.ok ? found.rows[0] : null;
    if (!quote) return respond(404, { ok: false, code: "quote_not_yours" });

    // Read what this quote has already produced before deciding. An unreadable
    // list is not an empty one -- treating a failed read as "nothing yet" is
    // how the same job gets billed twice.
    const invoiced = await supabaseList(config, "customer_invoices", `?select=id,quote_id,invoice_number&quote_id=eq.${encodeURIComponent(quoteId)}&organization_id=eq.${encodeURIComponent(org.organizationId)}&limit=5`);
    if (!invoiced.ok) return respond(503, { ok: false, code: "cannot_check_existing" });

    const refusal = quoteConversion.reasonNotConvertible(quote, invoiced.rows);
    if (refusal) return respond(409, { ok: false, code: "not_convertible", reason: refusal });

    const invoice = quoteConversion.invoiceFromQuote(quote, {
      organizationId: org.organizationId,
      userId: req.sonaraAccess?.user?.id || null
    });
    const saved = await supabaseInsert(config, "customer_invoices", invoice);
    if (saved?.ok === false) return respond(502, saved);

    // supabaseInsert asks for return=representation, so the created row comes
    // back in `rows`. Read from that rather than assuming a shape.
    const invoiceId = Array.isArray(saved?.rows) ? saved.rows[0]?.id || null : null;
    if (!invoiceId) return respond(502, { ok: false, code: "invoice_id_missing" });

    // The line is best-effort. An invoice that exists without its opening line
    // is recoverable by adding one; failing the whole conversion after the
    // invoice is already written would leave the owner unable to retry, because
    // the duplicate check would then refuse.
    await supabaseInsert(config, "customer_invoice_lines", {
      ...quoteConversion.lineFromQuote(quote, { organizationId: org.organizationId }),
      invoice_id: invoiceId
    });

    return respond(200, { ok: true, invoiceId });
  });

  // Approving a source this business may research.
  //
  // The counterpart to the gate in routes/market-intelligence-routes.cjs: that
  // file refuses to fetch a host no approved row covers, and this is how a row
  // becomes approved after it was created.
  //
  // The owner acting, not an agent. lib/sonara-agent-authority.cjs governs what
  // runs without a person, and a person pressing a button they can see is the
  // person. This records a judgement only they can make -- whether a site is
  // theirs, is public, or its owner has agreed -- which is exactly the judgement
  // this product is not in a position to make for them.
  app.post("/api/business/research-sources/:sourceId/approve", requireBusinessManager, async (req, res) => {
    const sourceId = String(req.params.sourceId || "");
    const back = "/business-builder/owner/research-sources";
    const respond = (status, payload) => {
      if (!acceptsHtml(req)) return res.status(status).json(payload);
      return res.redirect(303, payload.ok ? `${back}?approved=1` : `${back}?problem=${encodeURIComponent(payload.code || "not_approved")}`);
    };

    if (!isUuid(sourceId)) return respond(400, { ok: false, code: "source_required" });
    const config = getConfig(deps);
    if (!config.ok) return respond(503, { ok: false, code: "setup_required", service: "supabase" });
    const org = await resolveOrganization(req, deps);
    if (!org.ok) return respond(403, org);

    // Scoped by organization as well as by id. The service key bypasses row
    // level security, so without this a guessed id would approve a source
    // belonging to another business -- and an approved row is what decides
    // which sites this server will go and fetch.
    const found = await supabaseList(config, "research_sources", `?select=id,source_url,permission_status&id=eq.${encodeURIComponent(sourceId)}&organization_id=eq.${encodeURIComponent(org.organizationId)}&limit=1`);
    if (!found.ok) return respond(503, { ok: false, code: "cannot_check_source" });
    const source = found.rows[0];
    // A failed read and an id that is not yours are different answers, and they
    // are separated above rather than both arriving here as "not found".
    if (!source) return respond(404, { ok: false, code: "source_not_yours" });
    if (!source.source_url) return respond(409, { ok: false, code: "source_has_no_address" });

    const saved = await supabasePatch(config, "research_sources", sourceId, {
      permission_status: "approved",
      updated_at: new Date().toISOString()
    });
    if (!saved.ok) return respond(502, { ok: false, code: "not_approved" });
    return respond(200, { ok: true, approved: true, sourceId });
  });

  // The staff portal is what the Team plan sells.
  //
  // docs/pricing/2026-08-11-PRICING-RESTRUCTURE.md says so plainly: "The staff
  // portal, per-person schedules, time entries and assigned tasks already exist
  // and are given away." Every page below opened for any signed-in customer,
  // including free accounts, so Team at $79 charged for something nobody had to
  // pay for. A plan whose only difference is a sentence on the pricing page is
  // not a plan.
  //
  // requirePaidOrOwnerAccess rather than a hand-rolled check, because it already
  // separates the three answers this needs kept apart: paid, not paid, and a
  // billing read that did not answer. The third returns 503 with "this is on our
  // side", never a paywall -- an employee shown "upgrade required" because
  // Supabase was slow is being told their employer has not paid.
  //
  // Owners and admins pass through, as everywhere else.
  const staffPortalAccess = typeof deps.requirePaidOrOwnerAccess === "function"
    ? deps.requirePaidOrOwnerAccess("staff_portal")
    : requireCustomer;

  STAFF_PAGES.forEach(([path, title, body]) => {
    app.get(path, staffPortalAccess, async (req, res) => {
      const config = getConfig(deps);
      const org = await resolveOrganization(req, deps);
      const me = await resolveEmployee(config, org, req);
      const sections = await staffSections(config, org, me, path, ui);
      // What the no-JavaScript path says when it comes back.
      //
      // Without this the form redirects to a page that looks exactly as it did
      // before, which is a success reported to nobody. The list below will show
      // the new row, but only somebody who already knew to look would know that
      // is what changed.
      if (path === "/staff/location" && req.query.checked_in) {
        sections.unshift(ui.card("Checked in", "Your check-in was recorded. It is in the list below."));
      }
      if (path === "/staff/location" && req.query.problem) {
        sections.unshift(ui.card("Not recorded", "Your check-in was not saved. Try again."));
      }
      const html = ui.layout({
        title,
        eyebrow: "Staff portal",
        heading: title,
        body,
        sections,
        actions: [ui.link("/staff", "Staff Portal"), ui.link("/staff/schedule", "Schedule"), ui.link("/staff/time", "Time"), ui.link("/staff/tasks", "Tasks"), ui.link("/staff/announcements", "Announcements")]
      });
      // Only this page loads them. A script that captures a position has no
      // business being served to the four staff pages that never ask for one.
      return res.status(200).type("html").send(path === "/staff/location" ? withCheckInScripts(html) : html);
    });
  });

  CREATOR_RECORD_PAGES.forEach((page) => {
    app.get(page.path, requireWorkspaceAccess("creator_studio"), async (req, res) => {
      const config = getConfig(deps);
      const org = await resolveOrganization(req, deps);
      let rows = [];
      let extra = [];
      let references = {};
      let loaded = null;
      let unavailable = null;
      if (!config.ok) unavailable = "Your account database is not connected yet, so there is nothing to show.";
      else if (!org.ok) unavailable = "We could not tell which workspace you are in. Sign in again and this will fill up.";
      else {
        const listed = await listRecordPage(config, page.table, org.organizationId, "created_at.desc", page.select || "*", pageNumber(req.query.page));
        if (!listed.ok) unavailable = "This part of your account has not been set up yet.";
        else { rows = listed.rows; loaded = listed; }
        extra = await Promise.all((page.also || []).map(async (side) => {
          const sideRows = await listRecordPage(config, side.table, org.organizationId, "created_at.desc", side.select || "*");
          return { side, rows: sideRows.ok ? sideRows.rows : [], loaded: sideRows.ok ? sideRows : null };
        }));
        // The pickers. This passed {} to formCard, which was harmless while no
        // creator page had a reference field and wrong the moment one did: the
        // artist picker on all four artist-system pages would have rendered
        // "Nothing to choose yet -- add one first" to a customer with artists.
        // That exact failure is recorded above loadReferences, on the owner
        // pages, where it shipped.
        references = await loadReferences(config, org.organizationId, page);
      }
      const sections = unavailable
        ? [ui.card("Not available right now", unavailable)]
        : [
          recordsCard(page, rows, ui, loaded),
          // An `also` block renders its list and, when it declares one, its own
          // form directly under it.
          //
          // None of them carried a form, and vibration patterns were the cost:
          // the block listed them, the page's one form made sound cues, and the
          // only way to create a pattern was a direct POST. A list with no way
          // to add to it beside a list with one is not a design, and the empty
          // text had already been rewritten once to stop implying otherwise.
          //
          // formCard reads `form.action || api`, so a block needs both a form
          // and an api. A block with neither renders exactly as before.
          ...extra.flatMap(({ side, rows: sideRows, loaded: sideLoaded }) => [
            recordsCard({ ...side, columns: side.columns }, sideRows, ui, sideLoaded),
            ...(side.form && (side.form.action || side.api) ? [formCard(side, references, ui)] : [])
          ]),
          ...(page.form ? [formCard(page, references, ui)] : [])
        ];
      return res.status(200).type("html").send(ui.layout({
        title: page.title,
        eyebrow: "Creator Studio",
        heading: page.title,
        body: page.body,
        sections,
        // Generated from the pages themselves. The hand-written list named four
        // links and stayed at four when five pages were added beside it, which
        // is how the workspace index and the admin card index both went stale
        // before being generated for the same reason.
        actions: [
          ...CREATOR_RECORD_PAGES.filter((other) => other.path !== page.path).map((other) => ui.link(other.path, other.title)),
          ui.link("/creator-studio/dashboard", "Dashboard")
        ]
      }));
    });
  });

  app.get("/settings/device-feedback", requireCustomer, (req, res) => {
    return res.status(200).type("html").send(ui.layout({
      title: "Device Feedback",
      eyebrow: "Premium app feel",
      heading: "Sound, Vibration, Motion, and Location",
      body: "Test supported device features. Nothing starts automatically. Sounds, vibration, motion, and GPS need user action and browser permission.",
      sections: [
        `<div class="card"><h2>Test feedback</h2><p>Use this to verify browser support for sound and vibration.</p><button type="button" onclick="window.SONARA?.sensoryDevice?.feedback('success')">Test success feedback</button><p class="fine" id="deviceCaps"></p></div>`,
        ui.card("Privacy", "Location and motion data should be used only for clock-ins, job-site check-ins, routes, inspections, delivery stops, and approved creator cue workflows."),
        ui.card("Fallbacks", "If vibration, motion, or GPS is unsupported, the app must show a plain setup or unsupported message.")
      ],
      actions: [ui.link("/staff/location", "Staff Location"), ui.link("/creator-studio/device-cues", "Creator Cues"), ui.link("/settings", "Settings")]
    }).replace("</body>", `<script src="/sensory-device-client.js"></script><script>if(window.SONARA&&SONARA.sensoryDevice){document.getElementById('deviceCaps').textContent=JSON.stringify(SONARA.sensoryDevice.supports());}</script></body>`));
  });

  Object.entries(RESOURCE_MAP).forEach(([path, resource]) => registerRestResource(app, path, resource, deps, requireBusinessManager));

  PUBLIC_GETS.forEach((resource, path) => {
    app.get(path, async (req, res) => {
      const config = getConfig(deps);
      if (!config.ok) return res.status(503).json({ ok: false, code: "setup_required", service: "supabase" });
      return res.status(200).json(await supabaseList(config, resource.table, resource.query));
    });
  });

  app.post("/api/business/time-entries/start", requireCustomer, async (req, res) => {
    const config = getConfig(deps);
    if (!config.ok) return res.status(503).json({ ok: false, code: "setup_required", service: "supabase" });
    const org = await resolveOrganization(req, deps);
    if (!org.ok) return res.status(403).json(org);
    // Same check as the clock-out below. A manager legitimately clocks somebody
    // else in -- the form on /business-builder/owner/time asks "Who is
    // starting" -- so the employee is not forced to be the caller. It does have
    // to be one of this business's people.
    for (const [field, table] of [["employee_id", "business_employee_profiles"], ["location_id", "business_locations"]]) {
      const supplied = String(req.body[field] || "");
      if (!supplied) continue;
      const check = await belongsToOrganization(config, table, supplied, org.organizationId);
      if (!check.ok) return res.status(502).json({ ok: false, code: `${field}_unreadable` });
      if (!check.belongs) return res.status(403).json({ ok: false, code: `${field}_not_yours` });
    }
    const payload = {
      organization_id: org.organizationId,
      employee_id: req.body.employee_id || null,
      location_id: req.body.location_id || null,
      clock_in_at: new Date().toISOString(),
      entry_source: "employee_portal",
      status: "open",
      notes: sanitizeText(req.body.notes)
    };
    return res.status(200).json(await supabaseInsert(config, "employee_time_entries", payload));
  });

  // Clocking somebody out.
  //
  // This resolved no organization at all. It took an id from the body and
  // patched employee_time_entries with the service key, which bypasses row
  // level security -- so **any signed-in customer could close any time entry in
  // any business**, stamping clock_out_at, status and a break length of their
  // choosing. Every other write in this file checks ownership first, and the
  // comment above the line handler says why in as many words: without it, a row
  // can be written into another organization's record by posting its id.
  //
  // break_minutes is the part that reaches a number somebody is paid on.
  // workedHours() subtracts it, so a negative break adds hours, and it feeds
  // the labour cost on the daily sales page.
  //
  // The guard moves to requireBusinessManager to match the only page that
  // offers this: /business-builder/owner/time renders it as a row action, and
  // that page is manager-gated. Nothing else calls it.
  app.post("/api/business/time-entries/stop", requireBusinessManager, async (req, res) => {
    // A row action is an HTML form, so this answered a button press with raw
    // JSON in the browser. Same respond shape as the line handlers.
    const back = "/business-builder/owner/time";
    const respond = (status, payload) => {
      if (!acceptsHtml(req)) return res.status(status).json(payload);
      if (payload.ok) return res.redirect(303, back);
      return res.redirect(303, `${back}?problem=${encodeURIComponent(payload.code || "not_saved")}`);
    };
    const config = getConfig(deps);
    if (!config.ok) return respond(503, { ok: false, code: "setup_required", service: "supabase" });
    const id = sanitizeText(req.body.id);
    // A uuid rather than any non-empty string: this goes into a PostgREST
    // filter, and the id column is a uuid.
    if (!isUuid(id)) return respond(400, { ok: false, code: "validation_failed", message: "Missing time entry id." });
    const org = await resolveOrganization(req, deps);
    if (!org.ok) return respond(403, org);

    const owned = await supabaseList(config, "employee_time_entries", `?select=id&id=eq.${encodeURIComponent(id)}&organization_id=eq.${encodeURIComponent(org.organizationId)}&limit=1`);
    // A read that failed is not an entry that belongs to somebody else.
    if (!owned.ok) return respond(502, { ok: false, code: "entry_unreadable" });
    if (!owned.rows.length) return respond(403, { ok: false, code: "entry_not_yours" });

    const payload = {
      clock_out_at: new Date().toISOString(),
      status: "submitted",
      break_minutes: Math.max(0, Number(req.body.break_minutes || 0) || 0)
    };
    const saved = await supabasePatch(config, "employee_time_entries", id, payload);
    return respond(saved?.ok === false ? 502 : 200, saved);
  });

  app.post("/api/location/events", requireCustomer, async (req, res) => {
    const config = getConfig(deps);
    if (!config.ok) return res.status(503).json({ ok: false, code: "setup_required", service: "supabase" });
    const org = await resolveOrganization(req, deps);
    if (!org.ok) return res.status(403).json(org);
    // An employee and an area supplied by the caller both become part of this
    // row, and the staff portal lists check-ins by employee_id -- so an
    // unchecked one writes a location record onto a colleague's page, or
    // attaches it to another business's area. Absent is fine; wrong is not.
    for (const [field, table] of [["employee_id", "business_employee_profiles"], ["location_zone_id", "location_zones"]]) {
      const supplied = String(req.body[field] || "");
      if (!supplied) continue;
      const check = await belongsToOrganization(config, table, supplied, org.organizationId);
      if (!check.ok) return res.status(502).json({ ok: false, code: `${field}_unreadable` });
      if (!check.belongs) return res.status(403).json({ ok: false, code: `${field}_not_yours` });
    }
    // Staff may only attribute a check-in to themselves.
    //
    // The organization check below already stops a check-in being written into
    // another business. Within one business it stopped nothing: any signed-in
    // member could post a colleague's employee_id and put a location record on
    // that colleague's own /staff/location page. That was theoretical while
    // nothing posted to this endpoint. It stopped being theoretical the moment
    // that page grew a button.
    //
    // Only staff are constrained. Somebody with no employee profile of their
    // own is the owner or a manager, who can already write any record in their
    // own business, so refusing them here would protect nothing and break
    // recording a check-in on somebody's behalf.
    const suppliedEmployee = String(req.body.employee_id || "");
    if (suppliedEmployee) {
      const me = await resolveEmployee(config, org, req);
      if (me.ok && me.profile.id !== suppliedEmployee) {
        return res.status(403).json({ ok: false, code: "employee_id_not_yours" });
      }
    }

    // Checked against the list the table's own constraint allows, rather than
    // sanitised into whatever the caller typed. sanitizeChoice made
    // "check_inn" into a legal-looking string that PostgREST then rejected as
    // a check-constraint violation -- a database error nobody outside this file
    // can read, on a request that looked fine.
    const eventType = sanitizeChoice(req.body.event_type, "position_update");
    if (!LOCATION_EVENT_TYPES.includes(eventType)) {
      return res.status(400).json({ ok: false, code: "unknown_event_type", allowed: LOCATION_EVENT_TYPES });
    }

    // The precision the person asked for, applied again here.
    //
    // NOT as a second line of defence -- nothing on this side can recover
    // precision the browser already discarded, and it should not want to. It is
    // here so a payload that arrives finer than the mode it declares is stored
    // at the coarseness it claims. A row saying "approximate" while holding
    // seven decimal places is the shape of defect this codebase keeps finding:
    // a field that reports a guarantee it is not providing.
    const reduced = reducePosition(
      {
        latitude: toNumberOrNull(req.body.latitude),
        longitude: toNumberOrNull(req.body.longitude),
        accuracyMeters: toNumberOrNull(req.body.accuracy_meters ?? req.body.accuracy)
      },
      req.body.privacy_mode
    );

    const payload = {
      organization_id: org.organizationId,
      user_id: org.userId || null,
      employee_id: req.body.employee_id || null,
      location_zone_id: req.body.location_zone_id || null,
      event_type: eventType,
      latitude: reduced.latitude,
      longitude: reduced.longitude,
      accuracy_meters: reduced.accuracyMeters,
      // Movement, not position. Both are dropped when the position was
      // coarsened or withheld: a speed and a heading beside a masked coordinate
      // narrow it back down, which would undo the choice the person made.
      speed_mps: reduced.mode === "precise" ? toNumberOrNull(req.body.speed_mps ?? req.body.speed) : null,
      heading_degrees: reduced.mode === "precise" ? toNumberOrNull(req.body.heading_degrees ?? req.body.heading) : null,
      privacy_mode: reduced.mode,
      metadata: sanitizeObject(req.body.metadata)
    };
    const saved = await supabaseInsert(config, "location_events", payload);
    // A browser that submitted the form itself gets the page back, not JSON.
    //
    // The form carries a real method and action so it works with no JavaScript
    // at all -- which records a check-in with no position, the `manual` mode,
    // and is the honest outcome when nothing on the page could ask the device
    // where it is. Rendering raw JSON at somebody who pressed a button is not.
    if (acceptsHtml(req)) {
      return res.redirect(303, saved?.ok === false ? "/staff/location?problem=not_saved" : "/staff/location?checked_in=1");
    }
    return res.status(200).json(saved);
  });

  app.post("/api/motion/events", requireCustomer, async (req, res) => {
    const config = getConfig(deps);
    if (!config.ok) return res.status(503).json({ ok: false, code: "setup_required", service: "supabase" });
    const org = await resolveOrganization(req, deps);
    if (!org.ok) return res.status(403).json(org);
    const payload = {
      organization_id: org.organizationId,
      user_id: org.userId || null,
      event_type: sanitizeChoice(req.body.event_type, "device_motion"),
      alpha: toNumberOrNull(req.body.alpha),
      beta: toNumberOrNull(req.body.beta),
      gamma: toNumberOrNull(req.body.gamma),
      acceleration_x: toNumberOrNull(req.body.acceleration_x || req.body.accelerationX),
      acceleration_y: toNumberOrNull(req.body.acceleration_y || req.body.accelerationY),
      acceleration_z: toNumberOrNull(req.body.acceleration_z || req.body.accelerationZ),
      rotation_alpha: toNumberOrNull(req.body.rotation_alpha || req.body.rotationAlpha),
      rotation_beta: toNumberOrNull(req.body.rotation_beta || req.body.rotationBeta),
      rotation_gamma: toNumberOrNull(req.body.rotation_gamma || req.body.rotationGamma),
      gesture_label: sanitizeText(req.body.gesture_label),
      metadata: sanitizeObject(req.body.metadata)
    };
    return res.status(200).json(await supabaseInsert(config, "motion_sensor_events", payload));
  });

  app.get("/api/last9/readiness", async (req, res) => {
    const config = getConfig(deps);
    const tables = [
      "sonara_platforms", "business_employee_profiles", "employee_time_entries", "vendor_invoices", "inventory_items", "recipe_cards", "menu_items", "music_projects", "audio_assets", "location_events", "motion_sensor_events", "tactile_events"
    ];
    if (!config.ok) return res.status(503).json({ ok: false, code: "setup_required", service: "supabase", tables });
    const results = await Promise.all(tables.map((table) => supabaseCount(config, table).then((result) => ({ table, ...result }))));
    return res.status(200).json({ ok: true, tables: results });
  });
};

function registerRestResource(app, path, resource, deps, middleware) {
  app.get(path, middleware, async (req, res) => {
    const config = getConfig(deps);
    if (!config.ok) return res.status(503).json({ ok: false, code: "setup_required", service: "supabase" });
    // This read goes out with the service key, which bypasses row level
    // security, so the filter here is the only thing separating one business
    // from another. Without it this returned every organization's staff
    // profiles, bookings and vendor invoices to any signed-in manager. The
    // POST below had always scoped correctly; the GET never did.
    const org = await resolveOrganization(req, deps);
    if (!org.ok) return res.status(403).json(org);
    const limit = Math.min(Number(req.query.limit || 50) || 50, 100);
    const query = `?select=*&organization_id=eq.${encodeURIComponent(org.organizationId)}&order=created_at.desc&limit=${limit}`;
    return res.status(200).json(await supabaseList(config, resource.table, query));
  });

  app.post(path, middleware, async (req, res) => {
    // A form submission is a person, not a script. Send them back to the page
    // they were on rather than to the record they just created rendered as
    // JSON, which is where this used to leave them.
    const page = pageForApi(path);
    const returnTo = page ? page.path : null;
    const respond = (status, payload) => {
      if (!returnTo || !acceptsHtml(req)) return res.status(status).json(payload);
      if (payload.ok) return res.redirect(303, returnTo);
      return res.redirect(303, `${returnTo}?problem=${encodeURIComponent(payload.code || "not_saved")}`);
    };

    const missing = resource.required.filter((key) => !String(req.body[key] || "").trim());
    if (missing.length) return respond(400, { ok: false, code: "missing_required", missing });
    const config = getConfig(deps);
    if (!config.ok) return respond(503, { ok: false, code: "setup_required", service: "supabase" });
    const org = await resolveOrganization(req, deps);
    if (!org.ok) return respond(403, org);

    // Plan limits, for the resources that have one.
    //
    // The count is read before the insert rather than after, and a count that
    // could not be read refuses with "we could not check" rather than with "you
    // have hit your limit". Those are different sentences and only one of them
    // is true when the read failed.
    if (resource.planLimit === "locations") {
      const entitlement = typeof deps.getCustomerPaidEntitlement === "function"
        ? await deps.getCustomerPaidEntitlement(req.sonaraUser || req.sonaraAccess?.user || null, "business_builder")
        : null;
      const counted = await supabaseCount(config, resource.table, org.organizationId);
      const allowance = locationAllowance(entitlement?.ok ? entitlement.entitlementKey : "free", counted);
      if (!allowance.allowed) {
        return respond(allowance.unknown ? 503 : 402, {
          ok: false,
          code: allowance.unknown ? "limit_not_checked" : "plan_limit_reached",
          message: locationLimitMessage(allowance),
          included: allowance.included,
          used: allowance.used,
          upgrade_url: "/pricing"
        });
      }
    }

    // Only name a person column the table actually has. See RESOURCE_MAP.
    const person = resource.person ? { [resource.person]: org.userId || req.body[resource.person] || null } : {};
    // A form posts strings, so a blank optional field arrives as "" rather than
    // absent. dropBlanks already removes those; this also stops a body key
    // called user_id from reintroducing the column that caused the problem.
    const submitted = dropBlanks(req.body);
    delete submitted.user_id;
    delete submitted.organization_id;
    const payload = sanitizeObject({ ...resource.defaults, ...submitted, ...person, organization_id: org.organizationId });
    const saved = await supabaseInsert(config, resource.table, payload);
    return respond(saved?.ok === false ? 502 : 200, saved);
  });
}

// Which employee record belongs to the signed-in person. Everything personal in
// the staff portal hangs off this: no record, no rows. Returning nothing when we
// cannot identify somebody is the whole point -- the alternative is showing them
// the whole workplace.
async function resolveEmployee(config, org, req) {
  const user = req.sonaraUser || req.sonaraCustomer?.user || req.sonaraAccess?.user || null;
  if (!config.ok || !org.ok || !user?.id) return { ok: false };
  const found = await supabaseList(
    config,
    "business_employee_profiles",
    `?select=id,display_name,job_title,employment_type,status,location_id&organization_id=eq.${encodeURIComponent(org.organizationId)}&user_id=eq.${encodeURIComponent(user.id)}&limit=1`
  );
  const profile = found.ok ? found.rows[0] : undefined;
  return profile ? { ok: true, profile } : { ok: false };
}

const STAFF_EMPTY = "Nothing here yet.";

async function staffSections(config, org, me, path, ui) {
  if (!config.ok) return [ui.card("Not available right now", "Your workplace account is not connected yet, so there is nothing to show.")];
  if (!org.ok) return [ui.card("Not available right now", "We could not tell which workplace you belong to. Sign in again and this will fill up.")];

  // Announcements are addressed to the business, so they are the one thing here
  // that is not scoped to one person.
  if (path === "/staff/announcements") {
    const listed = await supabaseList(config, "employee_announcements", `?select=title,message,published_at,status&organization_id=eq.${encodeURIComponent(org.organizationId)}&status=eq.published&order=published_at.desc&limit=50`);
    if (!listed.ok) return [ui.card("Not available right now", "We could not load updates just now. Try again shortly.")];
    return listed.rows.length
      ? listed.rows.map((row) => ui.card(row.title || "Update", `${row.message || ""} ${row.published_at ? `Posted ${String(row.published_at).slice(0, 10)}.` : ""}`.trim()))
      : [ui.card("No updates", "Nothing has been posted to your workplace yet.")];
  }

  if (!me.ok) {
    return [ui.card("You are not set up as staff here yet", "Whoever runs your workplace needs to add you before your shifts, hours and tasks appear. Nothing is shown until then.")];
  }

  const employeeId = encodeURIComponent(me.profile.id);
  if (path === "/staff") {
    const profile = me.profile;
    return [
      ui.card(profile.display_name || "Your details", [
        profile.job_title ? `${profile.job_title}.` : "",
        `Working as ${String(profile.employment_type || "staff").replaceAll("_", " ")}.`,
        `Your access is ${String(profile.status || "active").replaceAll("_", " ")}.`
      ].filter(Boolean).join(" ")),
      ui.card("What you can see here", "Your own shifts, hours, tasks and check-ins, plus updates posted to the whole workplace. You do not see other people's.")
    ];
  }

  if (path === "/staff/schedule") {
    const listed = await supabaseList(config, "employee_schedules", `?select=role_label,starts_at,ends_at,status,notes&organization_id=eq.${encodeURIComponent(org.organizationId)}&employee_id=eq.${employeeId}&order=starts_at.desc&limit=50`);
    if (!listed.ok) return [ui.card("Not available right now", "We could not load your shifts just now.")];
    return listed.rows.length
      ? listed.rows.map((row) => ui.card(row.role_label || "Shift", `${when(row.starts_at)} to ${when(row.ends_at)}. ${String(row.status || "scheduled").replaceAll("_", " ")}.${row.notes ? ` ${row.notes}` : ""}`))
      : [ui.card("No shifts", "You have no shifts scheduled.")];
  }

  if (path === "/staff/time") {
    const listed = await supabaseList(config, "employee_time_entries", `?select=clock_in_at,clock_out_at,break_minutes,status&organization_id=eq.${encodeURIComponent(org.organizationId)}&employee_id=eq.${employeeId}&order=clock_in_at.desc&limit=50`);
    if (!listed.ok) return [ui.card("Not available right now", "We could not load your hours just now.")];
    return listed.rows.length
      ? listed.rows.map((row) => ui.card(when(row.clock_in_at), `${row.clock_out_at ? `Until ${when(row.clock_out_at)}. ${workedHours(row)}.` : "Still open."} ${String(row.status || "open").replaceAll("_", " ")}.`))
      : [ui.card("No hours recorded", STAFF_EMPTY)];
  }

  if (path === "/staff/tasks") {
    const listed = await supabaseList(config, "employee_tasks", `?select=title,description,due_at,priority,status&organization_id=eq.${encodeURIComponent(org.organizationId)}&assigned_employee_id=eq.${employeeId}&order=due_at.asc&limit=50`);
    if (!listed.ok) return [ui.card("Not available right now", "We could not load your tasks just now.")];
    return listed.rows.length
      ? listed.rows.map((row) => ui.card(row.title || "Task", [
        row.description || "",
        row.due_at ? `Due ${when(row.due_at)}.` : "No due date.",
        `${String(row.priority || "normal").replaceAll("_", " ")} priority, ${String(row.status || "todo").replaceAll("_", " ")}.`
      ].filter(Boolean).join(" ")))
      : [ui.card("No tasks", "Nothing has been assigned to you.")];
  }

  if (path === "/staff/location") {
    const listed = await supabaseList(config, "location_events", `?select=event_type,created_at,privacy_mode&organization_id=eq.${encodeURIComponent(org.organizationId)}&employee_id=eq.${employeeId}&order=created_at.desc&limit=50`);
    if (!listed.ok) return [ui.card("Not available right now", "We could not load your check-ins just now.")];
    // Each check-in says how precisely it recorded where the person was.
    //
    // privacy_mode was in this query and rendered nowhere, so somebody reading
    // their own location history was not told which of precise, approximate,
    // masked or manual applied to them -- while the column is `not null default
    // 'precise'` and nothing has ever set it to anything else. The most precise
    // setting, chosen by the database, shown to nobody.
    //
    // The card also says what IS kept rather than only what does not happen.
    // "Nothing tracks you in the background" was true and one-sided; a person
    // looking at their own location record wants the other half of the sentence.
    return [
      ui.card(
        "What is recorded, and what is not",
        "A check-in happens when you choose to record one and your device allows it \u2014 nothing here follows you in the background. Each one below says how precisely your position was stored."
      ),
      checkInCard(me.profile.id, ui),
      ...(listed.rows.length
        ? listed.rows.map((row) => ui.card(
          String(row.event_type || "check-in").replaceAll("_", " "),
          `${when(row.created_at)}. ${plainLanguage.locationPrecisionLabel(row.privacy_mode)}.`
        ))
        : [ui.card("No check-ins", STAFF_EMPTY)])
    ];
  }

  return [ui.card("Nothing here yet", STAFF_EMPTY)];
}

// The check-in form, and the reason it is four radio buttons rather than a
// button.
//
// `location_events.privacy_mode` has allowed precise, approximate, masked and
// manual since migration 015 and has never held anything but the default. The
// page above renders the value, so every person reading their own history has
// been told "precise" by a database default rather than by a choice they made.
//
// Making it a choice is the whole feature. A tradesperson checking in at a
// customer's house and a delivery driver on a route want different things
// recorded about them, and neither of them wants the answer decided by a column
// default. `approximate` is preselected rather than `precise`: a default that
// errs is going to err, and erring towards less of somebody's location is the
// recoverable direction.
//
// The rounding runs in the browser before anything is sent -- see
// public/sonara-location-precision.js. Rounding here would describe the storage
// and not the disclosure.
function checkInCard(employeeId, ui) {
  const options = LOCATION_PRIVACY_MODES.map((mode) => {
    const checked = mode.value === LOCATION_PRECISION_DEFAULT ? " checked" : "";
    return `<label class="choice"><input type="radio" name="privacy_mode" value="${ui.escape(mode.value)}"${checked}> <strong>${ui.escape(mode.label)}</strong><span class="fine"> ${ui.escape(mode.note)}</span></label>`;
  }).join("");

  // Configuration as JSON in a script tag, not a global set by inline script:
  // the Content-Security-Policy is `script-src 'self'` and an inline script
  // would need 'unsafe-inline'.
  // `<` escaped as its JSON unicode form rather than HTML-escaped. The contents
  // of a <script> element are raw text, so HTML entities inside one are NOT
  // decoded -- escaping the quotes would hand JSON.parse a string full of
  // `&quot;`. What actually needs neutralising is a literal `</script>` in the
  // data, and \u003c does that while staying valid JSON.
  const config = JSON.stringify({ endpoint: "/api/location/events", employeeId }).replaceAll("<", "\\u003c");

  return [
    '<div class="card">',
    "<h2>Record a check-in</h2>",
    "<p>Nothing is sent until you press the button, and only what you pick here is sent.</p>",
    `<script type="application/json" id="sonara-check-in-config">${config}</script>`,
    '<form id="sonara-check-in-form" method="post" action="/api/location/events">',
    options,
    '<button class="action" type="submit" data-sonara-check-in-submit>Check in</button>',
    '<p class="fine" data-sonara-check-in-status></p>',
    "</form>",
    "</div>"
  ].join("");
}

// The two files the form above needs, added to the page rather than to every
// staff page. Both are `src` references to this origin, which is what the
// `script-src 'self'` policy allows and an inline script is not.
function withCheckInScripts(html) {
  return html.replace(
    "</body>",
    '<script src="/sonara-location-precision.js"></script><script src="/sonara-check-in.js"></script></body>'
  );
}

function when(value) {
  if (!value) return "Not set";
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return "Not set";
  return parsed.toISOString().replace("T", " ").slice(0, 16);
}

function workedHours(row) {
  const start = new Date(String(row.clock_in_at));
  const end = new Date(String(row.clock_out_at));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "Length not recorded";
  const minutes = (end - start) / 60000 - Number(row.break_minutes || 0);
  if (!Number.isFinite(minutes) || minutes < 0) return "Length not recorded";
  return `${(minutes / 60).toFixed(2)} hours`;
}

// An empty text box means "I did not fill this in", not "set this column to
// an empty string" -- which would fail a date or number column outright.
function dropBlanks(body) {
  return Object.fromEntries(Object.entries(body || {}).filter(([, value]) => !(typeof value === "string" && value.trim() === "")));
}

function acceptsHtml(req) {
  return String(req.get?.("accept") || "").includes("text/html")
    || String(req.get?.("content-type") || "").includes("application/x-www-form-urlencoded");
}

// The pickers on a page and on its line forms.
//
// This read `page.form.fields` only, and lineFormCard called formField with an
// empty references object -- so every reference field on a child line form
// rendered "Nothing to choose yet -- add one first", permanently, whatever the
// business had. Three did: the service picker when writing an invoice line, the
// stock picker on a recipe ingredient, and the menu picker on what sold. The
// invoice one had been shipped that way for a long time, telling a business
// with a full service catalogue to go and add a service first.
//
// The outcome travels too. `result.ok ? rows : []` rendered a failed read as
// the same empty picker, so "we could not load your customers" and "you have no
// customers" were the same sentence.
async function loadReferences(config, organizationId, page) {
  const fields = [
    ...(page.form?.fields || []),
    ...childrenOf(page).flatMap((spec) => spec.form?.fields || []),
    // `also` blocks carry forms now. None of their fields is a reference today,
    // and that is exactly when a picker breaks quietly: the first one added
    // would render "Nothing to choose yet" to a customer with records, which is
    // the failure recorded above for the child forms and again for the artist
    // pages. Both were found after they shipped.
    ...(page.also || []).flatMap((side) => side.form?.fields || [])
  ].filter((field) => field.type === "reference");

  const loaded = {};
  await Promise.all([...new Set(fields.map((field) => field.from))].map(async (from) => {
    const source = REFERENCE_SOURCES[from];
    if (!source) return;
    // "*" for eight of the nine sources. merchant_product_variants embeds its
    // parent's name, because a version row on its own says "Large" and that
    // labels nothing. A source that asks for an embed and does not get one
    // comes back not-ok, and formField renders "We could not load these just
    // now" rather than a picker full of adjectives.
    const select = encodeURIComponent(source.select || "*");
    const result = await supabaseList(config, source.table, `?select=${select}&organization_id=eq.${encodeURIComponent(organizationId)}&order=created_at.desc&limit=200`);
    loaded[from] = result.ok
      ? { ok: true, options: result.rows.map((row) => ({ id: row.id, label: String(source.label(row) || row.id) })) }
      : { ok: false, options: [] };
  }));
  return loaded;
}

// What the list is allowed to claim.
//
// This used to be `${rows.length} records`, which is true only when the read
// happened to return everything. A business with 250 customers saw "100
// records" -- not a truncated list, a wrong total, and nothing on the page
// said otherwise. The number of rows that came back is not the number of
// records that exist, and the difference is exactly what a page must not
// quietly collapse.
//
// Three cases, and each says only what is known:
//   the read reached the end          -- the count is the count
//   it did not, and the total is known -- say both, so the cap is visible
//   it did not, and the count failed   -- "more than N", the honest floor
// The box that narrows the list.
//
// Rendered from lib/sonara-record-filter.cjs, which reads its columns from the
// search module rather than holding a second list. A page whose records are not
// found by text gets no box and says why, in the words already recorded for
// that table -- "a shift is found by who and when, not by text" is a fact about
// shifts, and a control that would find nothing is worse than its absence.
function filterCard(page, wanted, ui) {
  const reason = recordFilter.reasonWithoutFilter(page);
  if (reason) return ui.card("Finding one of these", reason);
  if (!recordFilter.canFilter(page)) return "";

  const typed = wanted?.term || wanted?.typed || "";
  const note = wanted?.tooShort
    ? `<p class="fine" role="status">Type at least ${recordFilter.MINIMUM_TERM} characters. One letter matches almost everything, which is a list nobody can use.</p>`
    : "";
  const clear = wanted?.term ? ui.link(page.path, "Show all") : "";

  return [
    '<article class="card">',
    `<form method="get" action="${ui.escape(page.path)}" role="search">`,
    `<label>Find one<input type="search" name="q" value="${ui.escape(typed)}" minlength="${recordFilter.MINIMUM_TERM}" autocomplete="off"></label>`,
    '<button class="action" type="submit">Find</button>',
    clear,
    "</form>",
    note,
    "</article>"
  ].join("");
}

function recordCountCaption(rows, loaded, term = null) {
  const shown = rows.length;

  // With a filter on, "3 records" is true and useless -- the reader cannot tell
  // whether they have three customers or three matches. Everything below counts
  // the filtered rows, so the sentence has to say so.
  if (term) {
    const total = loaded && typeof loaded.total === "number" ? loaded.total : (loaded?.loadedAll ? shown : null);
    const said = recordFilter.describeFilter(term, loaded ? total : shown);
    if (!loaded || loaded.loadedAll || shown === 0) return said;
    const from = (loaded.offset || 0) + 1;
    return `${said} Showing ${from} to ${(loaded.offset || 0) + shown}.`;
  }
  const plural = (value) => (value === 1 ? "1 record" : `${value} records`);

  // No paging information at all: an older caller, or a page that never asked.
  // Describing what is on screen is the only claim available.
  if (!loaded) return plural(shown);
  if (loaded.loadedAll) return plural(loaded.total ?? shown);

  // Which rows these are, not just how many. "Showing the 100 most recent" is
  // wrong on page 2 -- they are not the most recent, they are the next 100 --
  // and a customer who cannot tell which window they are looking at cannot tell
  // whether the record they came for is missing or merely further along.
  const first = (loaded.offset || 0) + 1;
  const last = (loaded.offset || 0) + shown;
  if (shown === 0) return typeof loaded.total === "number" ? `${plural(loaded.total)}. This page is past the end.` : "No records on this page.";
  const window = `Showing ${first} to ${last}`;
  if (typeof loaded.total === "number") return `${plural(loaded.total)}. ${window}.`;
  return `More than ${last} records. ${window}.`;
}

// The way to the rest of them.
//
// The caption above was shipped first, saying a total existed beyond the cap
// while the page offered no way to reach it. That is better than the silence it
// replaced and it is not the same as being finished: a business told it has 250
// customers and shown 100 now has a number it cannot act on.
//
// Plain links, because the rest of these pages are plain forms and a customer
// who has disabled JavaScript still has a business to run.
function pagerLinks(page, loaded, ui, term = null) {
  if (!loaded || (!loaded.hasNext && !loaded.hasPrevious)) return "";
  // Carrying the filter. `?page=2` alone drops it, so "Next" would take
  // somebody from three matching customers to a hundred arbitrary ones with
  // nothing on the page saying anything had changed.
  const at = (number) => recordFilter.pathWith(page.path, { term, page: number });
  const links = [];
  if (loaded.hasPrevious) links.push(ui.link(at(loaded.page - 1), "Previous 100"));
  if (loaded.hasNext) links.push(ui.link(at(loaded.page + 1), "Next 100"));
  return `<nav class="card-actions" aria-label="More records">${links.join("")}</nav>`;
}

// Where a status change goes back to.
//
// A record with line items has a detail page and that is where the control is;
// everything else only has the list. Sending somebody back to a detail page
// that was never registered would answer 404 immediately after a change that
// actually succeeded -- which reads as a failure and is not one.
function statusReturnPath(page, recordId) {
  const id = encodeURIComponent(String(recordId || ""));
  return childrenOf(page).length > 0 ? `${page.path}/${id}` : page.path;
}

function recordsCard(page, rows, ui, loaded = null, term = null, archive = {}) {
  // A record with line items gets an extra column linking to them. Without it
  // the detail page exists and nothing points at it, which is the shape of
  // dead-end this codebase has shipped before.
  const opens = childrenOf(page).length > 0;

  // And an action a row can take on itself.
  //
  // Turning an accepted quote into an invoice was built, tested and shipped
  // with no way to press it -- the endpoint takes a path parameter, and the
  // form-reachability scan skips those, so nothing reported that the button did
  // not exist. Declaring the action beside the page means the row that can take
  // it renders it, and the row that cannot says why in the same column rather
  // than showing a button that will refuse.
  const action = page.rowAction || null;

  // And, for the record kinds with no detail page, the status control itself.
  //
  // Eleven pages declare a status; only four of those have line items and so a
  // detail page to put a card on. The other seven -- quotes, bookings,
  // customers, services, areas, payments made, receivables -- have the list and
  // nothing else, so the control lives in the row. Exactly one place per page:
  // where there is a detail page the card is there and this column is not.
  const rowStatus = recordStatus.hasStatus(page) && !opens ? recordStatus.statusOptionsFor(page) : null;

  // And a way to correct it. Every row, on every page whose form is a create
  // form -- without this the edit page is registered and nothing points at it,
  // which is the shape of dead-end this codebase has shipped before.
  const editable = recordEdit.canEdit(page);

  // And a way to take it off the list. Only on the sixteen pages whose records
  // have no terminal status of their own -- the rest already say "finished
  // with" in their own vocabulary, and two ways to do one thing is worse than
  // one way somebody has to learn.
  const archivable = recordArchive.canArchive(page);

  const extraHeads = [
    ...(opens ? ["<th>Details</th>"] : []),
    ...(editable ? ["<th>Correct</th>"] : []),
    // "Change status", not "Status". Several of these pages already show the
    // status as one of their own columns, and two headers reading Status is a
    // table nobody can read at a glance.
    ...(rowStatus ? ["<th>Change status</th>"] : []),
    ...(archivable ? ["<th>On your list</th>"] : []),
    ...(action ? [`<th>${ui.escape(action.columnLabel || "Action")}</th>`] : [])
  ];
  const head = [...page.columns.map((column) => `<th>${ui.escape(column.label)}</th>`), ...extraHeads].join("");
  const width = page.columns.length + extraHeads.length;
  const body = rows.length
    ? rows.map((row) => {
      const cells = page.columns.map((column) => `<td>${ui.escape(safeCell(column, row))}</td>`);
      if (opens) cells.push(`<td>${ui.link(`${page.path}/${encodeURIComponent(String(row.id || ""))}`, "Open")}</td>`);
      if (editable) cells.push(`<td>${ui.link(`${page.path}/${encodeURIComponent(String(row.id || ""))}/edit`, "Edit")}</td>`);
      if (rowStatus) cells.push(`<td>${statusControl(page, row, rowStatus, ui)}</td>`);
      if (archivable) cells.push(`<td>${archiveControl(page, row, ui)}</td>`);
      if (action) {
        const id = encodeURIComponent(String(row.id || ""));
        let reason = null;
        try {
          reason = action.reasonUnavailable ? action.reasonUnavailable(row) : null;
        } catch {
          // A spec that throws on an odd row must not take the page down.
          reason = "This cannot be checked right now.";
        }
        cells.push(
          reason
            ? `<td>${ui.escape(reason)}</td>`
            // Two shapes, because the endpoints are two shapes. Most take the
            // record in the path; some take it in the body, and forcing those
            // through a path parameter would mean changing a published API to
            // suit the renderer.
            : action.idField
              ? `<td><form method="post" action="${ui.escape(action.api)}"><input type="hidden" name="${ui.escape(action.idField)}" value="${ui.escape(String(row.id || ""))}"><button type="submit">${ui.escape(action.label)}</button></form></td>`
              : `<td><form method="post" action="${ui.escape(action.api.replace(":id", id))}"><button type="submit">${ui.escape(action.label)}</button></form></td>`
        );
      }
      return `<tr>${cells.join("")}</tr>`;
    }).join("")
    // "You have no customers yet" is false when the business has eight hundred
    // and none of them match what was typed.
    : `<tr><td colspan="${width}">${ui.escape(term ? `None of your records match "${term}". Clear the filter to see them all.` : page.empty)}</td></tr>`;
  const hidden = recordArchive.describeHidden(archive.archivedCount, { including: archive.showingArchived });
  const said = recordCountCaption(rows, loaded, term);
  // Appended rather than folded in: "12 records" stays the answer to how many
  // there are, and the archived line is a separate fact about what is on screen.
  // A single merged number would be a third thing that is neither.
  const count = hidden ? `${said} ${hidden}` : said;
  const toggle = archivable
    ? ui.link(
        recordFilter.pathWith(page.path, { term }) + (archive.showingArchived ? "" : (term ? "&" : "?") + "archived=1"),
        archive.showingArchived ? "Hide archived" : "Show archived too"
      )
    : "";
  const pager = page.path ? pagerLinks(page, loaded, ui, term) : "";
  return `<article class="card"><h2>${ui.escape(page.title)}</h2><p>${ui.escape(count)}</p>${toggle ? `<nav class="card-actions">${toggle}</nav>` : ""}<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>${pager}</article>`;
}

// One awkward value should cost its own cell, not the whole page.
function safeCell(column, row) {
  try {
    return column.value(row);
  } catch {
    return "Not set";
  }
}

// Sending this record to somebody who is not in the business.
//
// A form rather than a button with script behind it, matching every other write
// on these pages -- this application is server-rendered and works without
// JavaScript, and publishing a document is not the screen to make an exception
// on.
//
// The link is printed as text as well as linked, because the whole point of it
// is that somebody copies it into an email.
function shareCard(page, recordId, shareLink, ui) {
  const noun = page.shareNoun || "record";
  const base = `/api/shared-links/${encodeURIComponent(page.shareableAs)}/${encodeURIComponent(recordId)}`;
  const back = `<input type="hidden" name="back" value="${ui.escape(`${page.path}/${recordId}`)}">`;

  if (!shareLink?.ok) {
    return ui.card(
      "Sending this to somebody",
      `We could not check whether this ${noun} has been shared. Nothing has changed either way -- open this page again shortly.`
    );
  }
  if (shareLink.token) {
    const href = `/shared/${encodeURIComponent(shareLink.token)}`;
    return `<article class="card"><h2>Sending this to somebody</h2>
      <p>Anyone with this link can read this ${ui.escape(noun)}: <a href="${ui.escape(href)}">${ui.escape(href)}</a></p>
      <p class="fine">${ui.escape(page.shareShows || "It shows this record only. It never shows anybody's contact details, your notes, or anything else in your business.")}</p>
      <form method="post" action="${ui.escape(`${base}/revoke`)}">${back}<button type="submit">Stop sharing this</button></form>
    </article>`;
  }
  return `<article class="card"><h2>Sending this to somebody</h2>
    <p>Give this ${ui.escape(noun)} a link anyone can open, without them needing an account. You can stop sharing it at any time.</p>
    <p class="fine">${ui.escape(page.shareShows || "It shows this record only. It never shows anybody's contact details, your notes, or anything else in your business.")}</p>
    <form method="post" action="${ui.escape(`${base}/share`)}">${back}<button type="submit">Create a link</button></form>
  </article>`;
}

// Giving a creator profile a public address, and taking it back.
//
// A text field rather than a generated slug, because this is the thing a creator
// prints on a poster and says out loud. The field is pre-filled with the handle
// they already have, so re-submitting the form unchanged is a no-op rather than
// a way to lose the address by accident.
//
// published_at outlives the handle deliberately: a profile that was public and
// is not any more gets told so, rather than shown a form that looks untouched.
function publishCard(page, recordId, publishState, ui) {
  const base = `/api/creator-profiles/${encodeURIComponent(recordId)}`;
  const back = `<input type="hidden" name="back" value="${ui.escape(`${page.path}/${recordId}`)}">`;
  if (!publishState?.ok) {
    return ui.card("A public page for this profile", "We could not tell whether this profile has a public address. Nothing has changed -- open this page again shortly.");
  }
  if (publishState.handle) {
    const href = `/creator/${encodeURIComponent(publishState.handle)}`;
    return `<article class="card"><h2>A public page for this profile</h2>
      <p>Anyone can open this profile at <a href="${ui.escape(href)}">${ui.escape(href)}</a>, and follow it.</p>
      <p class="fine">It shows the artist name, the public description and how many people follow. It never shows the backstory, the voice identity, the genre blend, or any of the writing, visual or prompt rules.</p>
      <form method="post" action="${ui.escape(`${base}/unpublish`)}">${back}<button type="submit">Make this private again</button></form>
    </article>`;
  }
  const wasPublic = publishState.publishedBefore
    ? "<p class=\"fine\">This profile has been public before and is private now.</p>"
    : "";
  return `<article class="card"><h2>A public page for this profile</h2>
    <p>Give this profile an address anyone can open, without them needing an account.</p>
    <p class="fine">It shows the artist name, the public description and how many people follow. It never shows the backstory, the voice identity, the genre blend, or any of the writing, visual or prompt rules.</p>
    ${wasPublic}
    <form method="post" action="${ui.escape(`${base}/publish`)}">${back}
      <label>Address<input type="text" name="handle" minlength="3" maxlength="32" pattern="[a-z0-9][a-z0-9-]{1,30}[a-z0-9]" placeholder="your-name" required></label>
      <button type="submit">Publish this profile</button>
    </form>
  </article>`;
}

// The parent record, said back to the person who opened it. Uses the same
// column definitions as the list, so the detail page cannot describe a record
// differently from the row that led to it.
function summaryCard(page, row, ui) {
  const cells = page.columns
    .map((column) => `<tr><th>${ui.escape(column.label)}</th><td>${ui.escape(safeCell(column, row))}</td></tr>`)
    .join("");
  return `<article class="card"><h2>${ui.escape(page.title)}</h2><table><tbody>${cells}</tbody></table></article>`;
}

// The control for the field whose whole purpose is to change.
//
// Rendered from the page's own declaration, so the options a person can pick
// are exactly the ones the create form offers and the database allows. A
// hand-written list here would be the third copy and the first to drift.
// The create form again, with the record already in it.
//
// The same `formField` renderer, so a field type added to the create form is
// editable the day it is added. A second renderer here would be the copy that
// drifts, and the divergence would show up as an edit form quietly missing the
// newest field -- which looks exactly like a field that has no value.
function editFormCard(page, row, references, ui, problem) {
  const fields = recordEdit
    .editableFields(page)
    .map((field) => formField(field, references, ui, recordEdit.currentValue(field, row)))
    .join("");
  const outcome = problem ? `<p class="fine" role="status">${ui.escape(String(problem).slice(0, 300))}</p>` : "";
  return [
    '<article class="card">',
    `<h2>Correct this ${ui.escape(recordNoun(page))}</h2>`,
    outcome,
    `<form method="post" action="${ui.escape(`${page.path}/${encodeURIComponent(String(row?.id || ""))}`)}">`,
    fields,
    '<button class="action" type="submit">Save changes</button>',
    "</form>",
    "</article>"
  ].join("");
}

// "Correct this customer" rather than "Correct this Customers". The page titles
// are plural because they name lists, and a heading over one record should not
// be.
function recordNoun(page) {
  const title = String(page?.title || "record").toLowerCase();
  if (title.endsWith("ies")) return `${title.slice(0, -3)}y`;
  if (title.endsWith("sses") || title.endsWith("ches") || title.endsWith("shes")) return title.slice(0, -2);
  if (title.endsWith("s")) return title.slice(0, -1);
  return title;
}

// What has happened to this record.
//
// Three states rather than two, like every other read on these pages: entries,
// no entries, and **we could not tell**. A read that failed rendered as "nothing
// has been changed" would tell somebody a definite thing about their own history
// on the strength of a request that did not happen -- and this is the page where
// they came to check exactly that before changing something themselves.
function historyCard(history, ui) {
  if (!history?.ok) {
    return ui.card("Changes", "We could not read this record's history just now. That does not mean nothing has changed.");
  }
  const entries = history.entries || [];
  if (!entries.length) {
    return ui.card("Changes", "Nothing has been changed since this was created.");
  }
  const rows = entries
    .map((entry) => {
      const when = entry.when ? String(entry.when).slice(0, 16).replace("T", " ") : "at an unrecorded time";
      return `<tr><td>${ui.escape(entry.what)}</td><td>${ui.escape(entry.who)}</td><td>${ui.escape(when)}</td></tr>`;
    })
    .join("");
  return [
    '<article class="card">',
    "<h2>Changes</h2>",
    // Said rather than left to be discovered. Somebody reading a history and
    // finding no old value will otherwise assume it is missing rather than
    // deliberately absent.
    '<p class="fine">Which fields changed, and when. The values themselves are not kept here — these records hold contact details, and a second copy of them would be a second place erasure has to reach.</p>',
    "<table><thead><tr><th>What</th><th>Who</th><th>When</th></tr></thead><tbody>",
    rows,
    "</tbody></table>",
    "</article>"
  ].join("");
}

// Off the list, or back on it.
//
// One button whose label is the action, not the state. "Archived / Current" as
// a status word would leave somebody guessing whether pressing it sets that
// state or leaves it.
function archiveControl(page, row, ui) {
  const archived = Boolean(row?.archived_at);
  const id = encodeURIComponent(String(row?.id || ""));
  return [
    `<form method="post" action="${ui.escape(`${page.path}/${id}/archive`)}">`,
    `<input type="hidden" name="archived" value="${archived ? "0" : "1"}">`,
    `<button class="action" type="submit">${archived ? "Put back" : "Archive"}</button>`,
    "</form>"
  ].join("");
}

function statusControl(page, row, options, ui) {
  const current = String(row?.status || "");
  const id = String(row?.id || "");
  const choices = options
    .map((value) => `<option value="${ui.escape(value)}"${value === current ? " selected" : ""}>${ui.escape(readableStatus(value))}</option>`)
    .join("");
  return [
    `<form method="post" action="${ui.escape(`${page.path}/${encodeURIComponent(id)}/status`)}">`,
    // The column header already says Status, so the visible label would be the
    // same word twice in every row. The select still needs a name for anybody
    // arriving by keyboard or screen reader, and aria-label is that name.
    `<select name="status" aria-label="Status">${choices}</select>`,
    '<button class="action" type="submit">Save</button>',
    "</form>"
  ].join("");
}

// Underscores are how the database spells these; they are not how anybody
// reads them.
function readableStatus(value) {
  return String(value || "").replaceAll("_", " ");
}

// What happened last time somebody pressed one of those buttons.
//
// Carried in the query string because the change is a POST that redirects, and
// rendered wherever the control is. Without it a status change looks exactly
// like a page reload -- including the case that matters most, where the record
// already had the status asked for and genuinely nothing changed.
function statusOutcome(ui, problem, done) {
  const text = problem || done;
  if (!text) return "";
  return `<p class="fine" role="status">${ui.escape(String(text).slice(0, 300))}</p>`;
}

// The control for the field whose whole purpose is to change.
//
// Rendered from the page's own declaration, so the options a person can pick
// are exactly the ones the create form offers and the database allows. A
// hand-written list here would be the third copy and the first to drift.
function statusCard(page, row, ui, problem, done) {
  const options = recordStatus.statusOptionsFor(page);
  const current = String(row?.status || "");

  // Said above the control rather than only after it. Somebody arriving to
  // change a status wants to know what it is now.
  const note = current
    ? `This is ${ui.escape(readableStatus(current))} at the moment.`
    : "This has no status recorded yet.";

  return [
    '<article class="card">',
    "<h2>Status</h2>",
    `<p>${note}</p>`,
    statusOutcome(ui, problem, done),
    statusControl(page, row, options, ui),
    "</article>"
  ].join("");
}

function linesCard(spec, listed, ui) {
  const loaded = listed?.ok === true;
  const rows = listed?.rows || [];
  const head = spec.columns.map((column) => `<th>${ui.escape(column.label)}</th>`).join("");
  // "None yet" and "we could not read them" are different sentences, and only
  // one of them is true when the request failed.
  const nothing = loaded ? spec.empty : "We could not load these just now. Try again shortly.";
  const body = rows.length
    ? rows.map((row) => `<tr>${spec.columns.map((column) => `<td>${ui.escape(safeCell(column, row))}</td>`).join("")}</tr>`).join("")
    : `<tr><td colspan="${spec.columns.length}">${ui.escape(nothing)}</td></tr>`;
  // Totalled from the lines that are actually here, and only when every one of
  // them carries a number. A total computed over rows with missing values would
  // read as the real figure while being short by however many were blank.
  // finiteNumber rather than Number, because Number(null) and Number("") are
  // both 0 and both finite -- so a line with no amount recorded passed this
  // guard, counted as nothing, and the total below printed as complete while
  // being short. See lib/sonara-owner-record-pages.cjs.
  const amounts = rows.map((row) => finiteNumber(row[spec.totalFrom]));
  const complete = amounts.length && amounts.every((amount) => amount !== null);
  const total = !loaded
    ? ""
    : complete
      ? `<p>Total of these lines: ${ui.escape(money(amounts.reduce((sum, amount) => sum + amount, 0)))}</p>`
      : rows.length ? "<p>Not totalled: some lines have no amount recorded.</p>" : "";
  return `<article class="card"><h2>${ui.escape(spec.title)}</h2>${total}<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></article>`;
}

// The parent id travels as a hidden field. The handler still checks the parent
// belongs to this business before writing, because a hidden field is a value
// the person submitting chooses.
function lineFormCard(spec, recordId, ui, references = {}) {
  const fields = spec.form.fields.map((field) => formField(field, references, ui)).join("");
  const parent = `<input type="hidden" name="${ui.escape(spec.parentColumn)}" value="${ui.escape(recordId)}">`;
  return `<article class="card"><h2>${ui.escape(spec.form.legend)}</h2><form method="post" action="${ui.escape(spec.api)}">${parent}${fields}<button type="submit">Save</button></form></article>`;
}

// Starting points by trade.
//
// business_vertical_templates has had columns since the platform redesign and no
// rows and no reader -- lib/sonara-subsystem-registry.cjs records it as
// "reference and reporting rather than a workspace" with the note that it "would
// fit the Business Builder setup flow if that gets built". Migration
// 20260819090000 gives it eight rows and this gives it a page.
//
// **Nothing here switches anything on.** A template says "a business like yours
// usually needs these" and links to the pages; the owner decides. Turning
// features on from a dropdown labelled with somebody's trade is how a customer
// ends up with pages they did not ask for and cannot find the way out of.
function registerVerticalTemplates(app, deps, ui) {
  const { plainRouteTitle } = require("../lib/sonara-route-registry.cjs");
  const { getSupabaseServerConfig } = deps;
  const requireCustomer = deps.requireCustomer || ((req, res, next) => next());

  app.get("/business-builder/templates", requireCustomer, async (req, res) => {
    const actions = [ui.link("/business-builder/dashboard", "Business Builder home"), ui.link("/business-builder/start", "Getting started")];
    const config = getSupabaseServerConfig();
    const page = (body, sections) => ui.layout({
      title: "Starting points",
      eyebrow: "Business Builder",
      heading: "Starting points by trade",
      body,
      sections,
      actions
    });

    if (!config.ok) {
      return res.status(200).type("html").send(page(
        "Your account database is not connected yet, so the starting points cannot load.",
        []
      ));
    }

    const listed = await supabaseList(config, "business_vertical_templates", "?select=label,plain_language_description,recommended_pages,recommended_apps&status=eq.active&order=label.asc&limit=50");
    // A read that failed renders as a read that failed. "There are no starting
    // points" is a claim about what this product offers, and during an outage it
    // would be false.
    if (!listed.ok) {
      return res.status(200).type("html").send(page(
        "We could not load the starting points just now. Nothing has changed -- try again shortly.",
        []
      ));
    }
    if (!listed.rows.length) {
      return res.status(200).type("html").send(page(
        "Starting points are being prepared and none are available in this workspace yet.",
        []
      ));
    }

    const cards = listed.rows.map((row) => {
      const pages = Array.isArray(row.recommended_pages) ? row.recommended_pages : [];
      const apps = Array.isArray(row.recommended_apps) ? row.recommended_apps : [];
      const links = pages
        .filter((path) => typeof path === "string" && path.startsWith("/"))
        .map((path) => ui.link(path, plainRouteTitle(path) || path))
        .join("");
      return `<article class="card"><h2>${ui.escape(row.label || "Starting point")}</h2>
        <p>${ui.escape(row.plain_language_description || "")}</p>
        ${apps.length ? `<p class="fine">${ui.escape(`Usually needs: ${apps.join(", ")}.`)}</p>` : ""}
        ${links ? `<div class="card-actions">${links}</div>` : ""}
      </article>`;
    });

    return res.status(200).type("html").send(page(
      "Pick the one closest to what you do. Each is a list of the pages a business like yours usually needs -- nothing is switched on, and you can ignore any of it.",
      cards
    ));
  });
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function formCard(page, references, ui) {
  const fields = page.form.fields.map((field) => formField(field, references, ui)).join("");
  // Most forms create a record at the page's own endpoint. A few do something
  // to the page's records instead -- clocking in is not "create a time entry",
  // it is "start one now" -- so the form may name its own action and its own
  // button rather than being forced through the list endpoint.
  const action = page.form.action || page.api;
  const submit = page.form.submitLabel || "Save";
  return `<article class="card"><h2>${ui.escape(page.form.legend)}</h2><form method="post" action="${ui.escape(action)}">${fields}<button type="submit">${ui.escape(submit)}</button></form></article>`;
}

// `current` is the value already on the record, for the edit form. It defaults
// to undefined so every create-form caller is unchanged: an input with no value
// attribute is an empty input, which is what creating a record wants.
function formField(field, references, ui, current = "") {
  const required = field.required ? " required" : "";
  const now = String(current ?? "");
  const label = ui.escape(field.label);
  const hint = field.hint ? `<span class="fine">${ui.escape(field.hint)}</span>` : "";
  const name = ui.escape(field.name);
  if (field.type === "reference") {
    // Three states, not two. A picker that could not be loaded must not read as
    // one with nothing in it -- the first tells a customer to go and create a
    // record they may already have dozens of.
    const source = references[field.from];
    const listed = source?.options || [];
    const options = listed.map((option) => `<option value="${ui.escape(option.id)}"${String(option.id) === now ? " selected" : ""}>${ui.escape(option.label)}</option>`).join("");

    // The record already chosen, when the list does not contain it.
    //
    // This is the edit form's problem, not the create form's. A picker whose
    // list failed to load -- or which is paged and does not reach this record
    // -- would otherwise render a select with no current value, and saving that
    // form would clear the reference somebody never touched. Keeping the
    // current one as an option means blank is a choice rather than an accident.
    const already = now && !listed.some((option) => String(option.id) === now)
      ? `<option value="${ui.escape(now)}" selected>The one already chosen</option>`
      : "";

    if (source && source.ok === false) {
      return `<label>${label}<select name="${name}"${required}>${already}<option value=""${already ? "" : " selected"}>We could not load these just now</option></select></label>${hint}`;
    }
    if (!options) return `<label>${label}<select name="${name}"${required}>${already}<option value="">${already ? "Choose a different one once they load" : "Nothing to choose yet — add one first"}</option></select></label>${hint}`;
    return `<label>${label}<select name="${name}"${required}>${already}<option value="">Choose one</option>${options}</select></label>${hint}`;
  }
  if (field.type === "select") {
    // A string option is its own label, which is right for a status column
    // whose values are already words. It is wrong for a boolean: "true" and
    // "false" are not what somebody choosing whether a sound plays should be
    // reading. An option may be { value, label } for that case, and every
    // string list already written is unchanged.
    const options = (field.options || []).map((option) => {
      const value = option && typeof option === "object" ? option.value : option;
      const shown = option && typeof option === "object" ? option.label : String(option).replaceAll("_", " ");
      return `<option value="${ui.escape(value)}"${String(value) === now ? " selected" : ""}>${ui.escape(shown)}</option>`;
    }).join("");
    return `<label>${label}<select name="${name}"${required}>${options}</select></label>${hint}`;
  }
  if (field.type === "textarea") {
    return `<label>${label}<textarea name="${name}" rows="4" maxlength="${Number(field.maxLength || 2000)}"${required}>${ui.escape(now)}</textarea></label>${hint}`;
  }
  const type = ui.escape(field.type || "text");
  const step = field.step ? ` step="${ui.escape(field.step)}"` : "";
  const maxLength = field.maxLength ? ` maxlength="${Number(field.maxLength)}"` : "";
  const value = now ? ` value="${ui.escape(now)}"` : "";
  return `<label>${label}<input type="${type}" name="${name}"${step}${maxLength}${value}${required}></label>${hint}`;
}

function ownerActions(ui, currentPath) {
  return [
    // On every owner record page, because the page a customer is on is the one
    // where they realise they cannot find the record they came for.
    ui.link("/search", "Search"),
    ui.link("/business-builder/owner", "Owner Dashboard"),
    ...ALL_OWNER_PAGES.filter((page) => page.path !== currentPath).slice(0, 4).map((page) => ui.link(page.path, page.title)),
    ui.link("/business-builder/dashboard", "Dashboard")
  ];
}

function buildUi(deps) {
  const escape = deps.escapeHtml || ((value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;"));
  return {
    layout: deps.layout || (({ title, eyebrow, heading, body, sections, actions }) => `<!doctype html><html><head><title>${escape(title)}</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"></head><body><main><p>${escape(eyebrow)}</p><h1>${escape(heading)}</h1><p>${escape(body)}</p><div>${(actions || []).join("")}</div><section>${(sections || []).join("")}</section></main></body></html>`),
    card: deps.brandCard || ((title, body) => `<article class="card"><h2>${escape(title)}</h2><p>${escape(body)}</p></article>`),
    link: deps.linkAction || ((href, label) => `<a class="action" href="${escape(href)}">${escape(label)}</a>`),
    escape
  };
}

// Counts of the customer's own records. These were counted across every
// organization on the system and printed on each owner page, so a business
// with no staff at all could be shown someone else's headcount.
async function operationsSummary(config, organizationId) {
  if (!config.ok) return [{ label: "Your records", value: "Not connected yet, so there is nothing to count." }];
  if (!organizationId) return [{ label: "Your records", value: "Sign in to your business to see your own counts." }];
  const tables = [
    ["Staff", "business_employee_profiles"],
    ["Time entries", "employee_time_entries"],
    ["Inventory", "inventory_items"],
    ["Vendors", "vendor_accounts"],
    // "Invoices" meant vendor invoices, which is money going out. The label
    // was ambiguous and the counterpart was missing entirely, so an owner
    // looking at this dashboard saw what they owed and nothing about what they
    // were owed -- the same outward-only bias the schema had before
    // customer_invoices existed. Both sides now, both labelled.
    ["Bills you owe", "vendor_invoices"],
    ["Customers", "customers"],
    ["Quotes", "quotes"],
    ["Invoices you have sent", "customer_invoices"],
    ["Recipes", "recipe_cards"],
    ["Menu", "menu_items"],
    ["Daily profit", "daily_profit_snapshots"],
    ["Music projects", "music_projects"],
    ["Location events", "location_events"]
  ];
  const results = await Promise.all(tables.map(async ([label, table]) => ({ label, result: await supabaseCount(config, table, organizationId) })));
  return results.map(({ label, result }) => ({ label, value: result.ok ? `${result.count} saved` : "Not set up yet." }));
}

async function resolveOrganization(req, deps) {
  const user = req.sonaraUser || req.sonaraCustomer?.user || req.sonaraAccess?.user || null;
  if (typeof deps.getCustomerPrimaryOrganization === "function" && user) {
    const org = await deps.getCustomerPrimaryOrganization(user);
    if (org?.ok) return { ok: true, organizationId: org.organizationId, userId: user.id };
  }
  // A development escape hatch, and it must stay one.
  //
  // This accepts an organization_id straight from the request body. There is no
  // membership check on that value and there cannot be a useful one -- the
  // whole point of the branch is to work without a resolved session. So while
  // it is on, any request can name any organization and this returns ok, and
  // every owner-record write that calls resolveOrganization would write into
  // whichever tenant the body asked for.
  //
  // It was gated on the environment variable alone, which meant one wrong value
  // in a production dashboard was a cross-tenant write hole with nothing in the
  // release chain looking at it. It is now inert in production regardless of
  // the variable: a convenience that can be switched on in production is not a
  // convenience, it is a control somebody else can reach.
  const orgFromBody = sanitizeText(req.body.organization_id);
  const manualOrgAllowed =
    process.env.SONARA_ALLOW_MANUAL_ORG_ID === "true" &&
    process.env.NODE_ENV !== "production" &&
    String(process.env.VERCEL_ENV || "").toLowerCase() !== "production";
  if (orgFromBody && manualOrgAllowed) return { ok: true, organizationId: orgFromBody, userId: user?.id || null };
  return { ok: false, code: "owner_access_required", message: "Business owner or staff session is required." };
}

function getConfig(deps) {
  if (typeof deps.getSupabaseServerConfig === "function") return deps.getSupabaseServerConfig();
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return { ok: false };
  return { ok: true, url: url.replace(/\/$/, ""), serviceRoleKey };
}

function headers(config, extra = {}) {
  return { apikey: config.serviceRoleKey, Authorization: `Bearer ${config.serviceRoleKey}`, "Content-Type": "application/json", ...extra };
}

// The dependency shape lib/sonara-push-subscriptions.cjs asks for, built from
// the one this file already has.
//
// getEnv falls back to process.env rather than refusing. Every other consumer
// of these routes passes it, and a missing one here would turn the notification
// into a thrown TypeError inside a request that has already saved a payment --
// the fallback reads the same variables the injected function does, and
// pushReadiness still refuses cleanly when the VAPID keys are absent.
function pushDeps(config, deps) {
  const getEnv = typeof deps.getEnv === "function" ? deps.getEnv : (name) => process.env[name];
  return { getEnv, supabaseUrl: config.url, serviceRoleHeaders: () => headers(config) };
}

// How many rows a record list loads at once.
//
// The number was already 100; what was missing was any acknowledgement of it.
// A list capped at 100 and captioned "100 records" tells a business with 250
// customers that it has 100 -- the page states a total it never measured.
const PAGE_SIZE = 100;

// Loads a page of records and knows whether it reached the end.
//
// Asking for one row more than we display is what makes the answer honest for
// free: getting PAGE_SIZE + 1 back proves there are more without a second
// query, and getting fewer proves there are not. The exact total is worth a
// second request, but only when we already know it is going to say something
// the first one could not -- so an account under the cap, which is nearly all
// of them, still costs exactly one query.
// `select` is the list view's level of detail: the fields its columns actually
// read, rather than every column the table has. Measured across the 22 owner
// record pages, `select=*` fetched 307 columns to render 112 -- 2.7x -- on
// every page load, for every row. A page that has not declared one still gets
// `*`, because a missing declaration must cost bandwidth rather than blank a
// cell. tests/record-selects-cover-every-column.test.js is what keeps a
// declaration honest as columns change.
// A page number the customer typed, made safe.
//
// Anything that is not a whole number at or above 1 is page 1 -- an unreadable
// ?page= should show the first page, not an error and not an empty table that
// looks like an account with no records in it.
function pageNumber(value) {
  const parsed = Number.parseInt(String(value ?? "1"), 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
}

async function listRecordPage(config, table, organizationId, order = "created_at.desc", select = "*", page = 1, filterClause = "") {
  const offset = (page - 1) * PAGE_SIZE;
  const window = offset > 0 ? `&offset=${offset}` : "";
  const query = `?select=${encodeURIComponent(select)}&organization_id=eq.${encodeURIComponent(organizationId)}${filterClause}&order=${order}&limit=${PAGE_SIZE + 1}${window}`;
  const listed = await supabaseList(config, table, query);
  if (!listed.ok) return listed;

  const more = listed.rows.length > PAGE_SIZE;
  const rows = more ? listed.rows.slice(0, PAGE_SIZE) : listed.rows;
  const base = { ok: true, table, rows, page, offset, hasNext: more, hasPrevious: page > 1 };

  // On the first page, reaching the end means the rows in hand are the total.
  // On any later page it does not -- the rows before the offset are still
  // records, and forgetting that would report page 3 of 250 as "12 records".
  if (!more && page === 1) return { ...base, total: rows.length, loadedAll: true };

  // Counted through the same filter as the list. An unfiltered count over a
  // filtered list would say "812 records" above three rows, which is a bigger
  // lie than no caption at all.
  const counted = await supabaseCount(config, table, organizationId, filterClause);
  // A failed count is left null rather than guessed at, and the caption says
  // only what the read itself established.
  return { ...base, total: counted.ok ? counted.count : null, loadedAll: false };
}

// Does this id name a row inside this organization?
//
// Three answers, not two, and callers have to keep them apart: yes, no, and
// "the read did not happen". Treating the third as "no" refuses a legitimate
// request during an outage; treating it as "yes" is a cross-tenant write.
//
// Used wherever a request supplies an id that becomes part of a row -- an
// employee to attribute hours to, an area to attach a check-in to. The service
// key bypasses row level security, so a supplied id is checked or it is trusted,
// and there is nothing in between.
async function belongsToOrganization(config, table, id, organizationId) {
  if (!isUuid(String(id || ""))) return { ok: true, belongs: false };
  const found = await supabaseList(config, table, `?select=id&id=eq.${encodeURIComponent(id)}&organization_id=eq.${encodeURIComponent(organizationId)}&limit=1`);
  if (!found.ok) return { ok: false, belongs: false };
  return { ok: true, belongs: found.rows.length > 0 };
}

async function supabaseList(config, table, query) {
  const response = await fetch(`${config.url}/rest/v1/${table}${query}`, { headers: headers(config) }).catch(() => undefined);
  if (!response?.ok) return { ok: false, code: "table_unavailable", table };
  const rows = await response.json().catch(() => []);
  return { ok: true, table, rows: Array.isArray(rows) ? rows : [] };
}

async function supabaseCount(config, table, organizationId, filterClause = "") {
  const scope = organizationId ? `&organization_id=eq.${encodeURIComponent(organizationId)}` : "";
  const response = await fetch(`${config.url}/rest/v1/${table}?select=id${scope}${filterClause}&limit=1`, { headers: headers(config, { Prefer: "count=exact" }) }).catch(() => undefined);
  if (!response?.ok) return { ok: false, count: null };
  const range = response.headers?.get?.("content-range") || "";
  const match = range.match(/\/(\d+)$/);
  return { ok: true, count: match ? Number(match[1]) : 0 };
}

async function supabaseInsert(config, table, payload) {
  const response = await fetch(`${config.url}/rest/v1/${table}`, { method: "POST", headers: headers(config, { Prefer: "return=representation" }), body: JSON.stringify(payload) }).catch(() => undefined);
  if (!response?.ok) return { ok: false, code: "insert_failed", table, status: response?.status || null };
  const rows = await response.json().catch(() => []);
  return { ok: true, table, rows };
}

// A PATCH filtered by organization as well as by id.
//
// supabasePatch above filters on id alone, which is right for the tables that
// have no organization column. These do, and the service key bypasses row level
// security, so the filter is the whole tenant boundary.
async function supabasePatchScoped(config, table, id, organizationId, payload) {
  const query = `?id=eq.${encodeURIComponent(id)}&organization_id=eq.${encodeURIComponent(organizationId)}`;
  const response = await fetch(`${config.url}/rest/v1/${table}${query}`, {
    method: "PATCH",
    headers: headers(config, { Prefer: "return=representation" }),
    body: JSON.stringify(payload)
  }).catch(() => undefined);
  if (!response?.ok) return { ok: false, code: "update_failed", table, status: response?.status || null, rows: [] };
  const rows = await response.json().catch(() => []);
  return { ok: true, table, rows: Array.isArray(rows) ? rows : [] };
}

async function supabasePatch(config, table, id, payload) {
  const response = await fetch(`${config.url}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: headers(config, { Prefer: "return=representation" }), body: JSON.stringify(payload) }).catch(() => undefined);
  if (!response?.ok) return { ok: false, code: "update_failed", table, status: response?.status || null };
  const rows = await response.json().catch(() => []);
  return { ok: true, table, rows };
}

function sanitizeText(value) {
  return String(value || "").trim().slice(0, 2000);
}

function sanitizeChoice(value, fallback) {
  const clean = sanitizeText(value).replace(/[^a-z0-9_\-]/gi, "_").slice(0, 80);
  return clean || fallback;
}

function sanitizeObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (["password", "secret", "token", "service_role", "api_key"].some((part) => key.toLowerCase().includes(part))) continue;
    output[key] = typeof item === "string" ? sanitizeText(item) : item;
  }
  return output;
}

function toNumberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function passthrough(req, res, next) {
  return next();
}

// Exported so tests/owner-record-inserts.test.js can check every entry's table
// and person column against lib/sonara-migration-columns.cjs. A payload naming
// a column the table does not have is rejected by PostgREST, which is how every
// form on these pages came to silently not save.
module.exports.RESOURCE_MAP = RESOURCE_MAP;
// Exported so the caption can be checked without a database. The defect it
// exists for is a sentence, and a sentence is testable.
module.exports.recordCountCaption = recordCountCaption;
module.exports.PAGE_SIZE = PAGE_SIZE;
module.exports.pageNumber = pageNumber;
