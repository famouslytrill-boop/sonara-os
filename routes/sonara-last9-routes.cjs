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
const { buildContactCard, buildContactBook } = require("../lib/sonara-contact-card.cjs");
const { GROWTH_RECORD_PAGES } = require("../lib/sonara-growth-record-pages.cjs");
const { GROWTH_TABLES } = require("../lib/sonara-growth-tables.cjs");
const plainLanguage = require("../lib/sonara-plain-language.cjs");
const { finiteNumber } = require("../lib/sonara-owner-record-pages.cjs");

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
  "/api/business/merchant-products": { table: "merchant_products", required: ["name"], person: "created_by", defaults: { status: "draft" } }
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

module.exports = function registerLastNineHoursRoutes(app, deps = {}) {
  const ui = buildUi(deps);
  const requireCustomer = deps.requireCustomer || passthrough;
  const requireBusinessManager = deps.requireBusinessManager || requireCustomer;
  const requireWorkspaceAccess = typeof deps.requireWorkspaceAccess === "function" ? deps.requireWorkspaceAccess : () => requireCustomer;

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
  // Only the three types whose meaning is unambiguous are served. payroll_summary
  // and journal_entries are refused by name: both require accounting judgement
  // this code has not been given -- what belongs in a journal line, and how gross
  // pay reconciles to cost -- and inventing them would put wrong figures in front
  // of an accountant, which is worse than putting none.
  const EXPORT_SOURCES = Object.freeze({
    bills: { table: "vendor_invoices", dateColumn: "created_at", columns: ["id", "created_at", "vendor_name", "invoice_number", "invoice_date", "due_date", "amount", "currency", "status", "notes"] },
    sales: { table: "pos_sales_summaries", dateColumn: "created_at", columns: ["id", "created_at", "business_date", "gross_sales", "net_sales", "tax_total", "discount_total", "transaction_count", "currency"] },
    inventory: { table: "inventory_items", dateColumn: "created_at", columns: ["id", "created_at", "item_name", "sku", "unit", "quantity_on_hand", "unit_cost", "reorder_point", "location_id"] }
  });

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

    const source = EXPORT_SOURCES[String(record.export_type || "")];
    if (!source) {
      // Named, not generic. "Not supported" tells somebody nothing about
      // whether to wait for it.
      return res.status(422).type("text").send(
        `A file for "${String(record.export_type || "unknown")}" exports is not built. Payroll summaries and journal entries need accounting decisions this system has not been given, and producing them from guesses would put wrong figures in front of your accountant. Bills, sales and inventory exports do download.`
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
      if (!config.ok) unavailable = "Your account database is not connected yet, so there is nothing to show.";
      else if (!org.ok) unavailable = "We could not tell which business you are signed in to. Sign in again and this will fill up.";
      else {
        const listed = await listRecordPage(config, page.table, org.organizationId, "created_at.desc", page.select || "*", pageNumber(req.query.page));
        if (!listed.ok) unavailable = "This part of your account has not been set up yet.";
        else { rows = listed.rows; loaded = listed; }
        references = await loadReferences(config, org.organizationId, page);
      }
      const sections = unavailable
        ? [ui.card("Not available right now", unavailable)]
        : [recordsCard(page, rows, ui, loaded), ...(page.form ? [formCard(page, references, ui)] : [])];
      return res.status(200).type("html").send(ui.layout({
        title: page.title,
        eyebrow: "Business Builder operations",
        heading: page.title,
        body: page.body,
        sections,
        actions: ownerActions(ui, page.path)
      }));
    });
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
            ...(typeof page.derivedCard === "function" ? [page.derivedCard(parent, childRows, ui, extra)].filter(Boolean) : []),
            ...children.flatMap((spec, index) => [linesCard(spec, childRows[index], ui), lineFormCard(spec, recordId, ui, references)])
          ];

      return res.status(unavailable && !parent && config.ok && org.ok ? 404 : 200).type("html").send(ui.layout({
        title: page.title,
        eyebrow: "Business Builder operations",
        heading: page.title,
        body: children.map((spec) => spec.title).join(" "),
        sections,
        actions: [ui.link(page.path, `All ${page.title.toLowerCase()}`), ui.link("/business-builder/owner", "Owner Dashboard"), ui.link("/business-builder/dashboard", "Dashboard")]
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
      const payload = sanitizeObject({ ...submitted, ...derived, [spec.parentColumn]: parentId, organization_id: org.organizationId });
      const saved = await supabaseInsert(config, spec.table, payload);
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

  STAFF_PAGES.forEach(([path, title, body]) => {
    app.get(path, requireCustomer, async (req, res) => {
      const config = getConfig(deps);
      const org = await resolveOrganization(req, deps);
      const me = await resolveEmployee(config, org, req);
      const sections = await staffSections(config, org, me, path, ui);
      return res.status(200).type("html").send(ui.layout({
        title,
        eyebrow: "Staff portal",
        heading: title,
        body,
        sections,
        actions: [ui.link("/staff", "Staff Portal"), ui.link("/staff/schedule", "Schedule"), ui.link("/staff/time", "Time"), ui.link("/staff/tasks", "Tasks"), ui.link("/staff/announcements", "Announcements")]
      }));
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

  app.post("/api/business/time-entries/stop", requireCustomer, async (req, res) => {
    const config = getConfig(deps);
    if (!config.ok) return res.status(503).json({ ok: false, code: "setup_required", service: "supabase" });
    const id = sanitizeText(req.body.id);
    if (!id) return res.status(400).json({ ok: false, code: "validation_failed", message: "Missing time entry id." });
    const payload = { clock_out_at: new Date().toISOString(), status: "submitted", break_minutes: Number(req.body.break_minutes || 0) || 0 };
    return res.status(200).json(await supabasePatch(config, "employee_time_entries", id, payload));
  });

  app.post("/api/location/events", requireCustomer, async (req, res) => {
    const config = getConfig(deps);
    if (!config.ok) return res.status(503).json({ ok: false, code: "setup_required", service: "supabase" });
    const org = await resolveOrganization(req, deps);
    if (!org.ok) return res.status(403).json(org);
    const payload = {
      organization_id: org.organizationId,
      user_id: org.userId || null,
      employee_id: req.body.employee_id || null,
      location_zone_id: req.body.location_zone_id || null,
      event_type: sanitizeChoice(req.body.event_type, "position_update"),
      latitude: toNumberOrNull(req.body.latitude),
      longitude: toNumberOrNull(req.body.longitude),
      accuracy_meters: toNumberOrNull(req.body.accuracy_meters || req.body.accuracy),
      speed_mps: toNumberOrNull(req.body.speed_mps || req.body.speed),
      heading_degrees: toNumberOrNull(req.body.heading_degrees || req.body.heading),
      privacy_mode: sanitizeChoice(req.body.privacy_mode, "precise"),
      metadata: sanitizeObject(req.body.metadata)
    };
    return res.status(200).json(await supabaseInsert(config, "location_events", payload));
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
function recordCountCaption(rows, loaded) {
  const shown = rows.length;
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
function pagerLinks(page, loaded, ui) {
  if (!loaded || (!loaded.hasNext && !loaded.hasPrevious)) return "";
  const at = (number) => `${page.path}?page=${number}`;
  const links = [];
  if (loaded.hasPrevious) links.push(ui.link(at(loaded.page - 1), "Previous 100"));
  if (loaded.hasNext) links.push(ui.link(at(loaded.page + 1), "Next 100"));
  return `<nav class="card-actions" aria-label="More records">${links.join("")}</nav>`;
}

function recordsCard(page, rows, ui, loaded = null) {
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
  const extraHeads = [...(opens ? ["<th>Details</th>"] : []), ...(action ? [`<th>${ui.escape(action.columnLabel || "Action")}</th>`] : [])];
  const head = [...page.columns.map((column) => `<th>${ui.escape(column.label)}</th>`), ...extraHeads].join("");
  const width = page.columns.length + extraHeads.length;
  const body = rows.length
    ? rows.map((row) => {
      const cells = page.columns.map((column) => `<td>${ui.escape(safeCell(column, row))}</td>`);
      if (opens) cells.push(`<td>${ui.link(`${page.path}/${encodeURIComponent(String(row.id || ""))}`, "Open")}</td>`);
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
    : `<tr><td colspan="${width}">${ui.escape(page.empty)}</td></tr>`;
  const count = recordCountCaption(rows, loaded);
  const pager = page.path ? pagerLinks(page, loaded, ui) : "";
  return `<article class="card"><h2>${ui.escape(page.title)}</h2><p>${ui.escape(count)}</p><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>${pager}</article>`;
}

// One awkward value should cost its own cell, not the whole page.
function safeCell(column, row) {
  try {
    return column.value(row);
  } catch {
    return "Not set";
  }
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

function formField(field, references, ui) {
  const required = field.required ? " required" : "";
  const label = ui.escape(field.label);
  const hint = field.hint ? `<span class="fine">${ui.escape(field.hint)}</span>` : "";
  const name = ui.escape(field.name);
  if (field.type === "reference") {
    // Three states, not two. A picker that could not be loaded must not read as
    // one with nothing in it -- the first tells a customer to go and create a
    // record they may already have dozens of.
    const source = references[field.from];
    const options = (source?.options || []).map((option) => `<option value="${ui.escape(option.id)}">${ui.escape(option.label)}</option>`).join("");
    if (source && source.ok === false) {
      return `<label>${label}<select name="${name}"${required}><option value="">We could not load these just now</option></select></label>${hint}`;
    }
    if (!options) return `<label>${label}<select name="${name}"${required}><option value="">Nothing to choose yet — add one first</option></select></label>${hint}`;
    return `<label>${label}<select name="${name}"${required}><option value="">Choose one</option>${options}</select></label>${hint}`;
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
      return `<option value="${ui.escape(value)}">${ui.escape(shown)}</option>`;
    }).join("");
    return `<label>${label}<select name="${name}"${required}>${options}</select></label>${hint}`;
  }
  if (field.type === "textarea") {
    return `<label>${label}<textarea name="${name}" rows="4" maxlength="${Number(field.maxLength || 2000)}"${required}></textarea></label>${hint}`;
  }
  const type = ui.escape(field.type || "text");
  const step = field.step ? ` step="${ui.escape(field.step)}"` : "";
  const maxLength = field.maxLength ? ` maxlength="${Number(field.maxLength)}"` : "";
  return `<label>${label}<input type="${type}" name="${name}"${step}${maxLength}${required}></label>${hint}`;
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

async function listRecordPage(config, table, organizationId, order = "created_at.desc", select = "*", page = 1) {
  const offset = (page - 1) * PAGE_SIZE;
  const window = offset > 0 ? `&offset=${offset}` : "";
  const query = `?select=${encodeURIComponent(select)}&organization_id=eq.${encodeURIComponent(organizationId)}&order=${order}&limit=${PAGE_SIZE + 1}${window}`;
  const listed = await supabaseList(config, table, query);
  if (!listed.ok) return listed;

  const more = listed.rows.length > PAGE_SIZE;
  const rows = more ? listed.rows.slice(0, PAGE_SIZE) : listed.rows;
  const base = { ok: true, table, rows, page, offset, hasNext: more, hasPrevious: page > 1 };

  // On the first page, reaching the end means the rows in hand are the total.
  // On any later page it does not -- the rows before the offset are still
  // records, and forgetting that would report page 3 of 250 as "12 records".
  if (!more && page === 1) return { ...base, total: rows.length, loadedAll: true };

  const counted = await supabaseCount(config, table, organizationId);
  // A failed count is left null rather than guessed at, and the caption says
  // only what the read itself established.
  return { ...base, total: counted.ok ? counted.count : null, loadedAll: false };
}

async function supabaseList(config, table, query) {
  const response = await fetch(`${config.url}/rest/v1/${table}${query}`, { headers: headers(config) }).catch(() => undefined);
  if (!response?.ok) return { ok: false, code: "table_unavailable", table };
  const rows = await response.json().catch(() => []);
  return { ok: true, table, rows: Array.isArray(rows) ? rows : [] };
}

async function supabaseCount(config, table, organizationId) {
  const scope = organizationId ? `&organization_id=eq.${encodeURIComponent(organizationId)}` : "";
  const response = await fetch(`${config.url}/rest/v1/${table}?select=id${scope}&limit=1`, { headers: headers(config, { Prefer: "count=exact" }) }).catch(() => undefined);
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
