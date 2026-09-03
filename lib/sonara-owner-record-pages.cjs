"use strict";

const { finiteNumber } = require("./sonara-numbers.cjs");
const { labourCostForDay, labourGapSentence } = require("./sonara-labour-cost.cjs");
const { ACCOUNTING_EXPORT_TYPES } = require("./sonara-accounting-export-sources.cjs");

// The Business Builder owner pages.
//
// Fifteen of them shipped as descriptions of themselves. "Locations: manage
// storefronts, mobile stops, food trucks, trailers, job sites and service
// areas" -- and then two boilerplate cards and a row of counts. No records, no
// way to add one, on the product whose whole promise is running a business.
// The CRUD API behind them had existed the entire time.
//
// Each page is a description rather than a handler: which records, which
// columns, and which fields go in the form. The rendering is done once in
// routes/sonara-last9-routes.cjs.
//
// Rules that hold throughout:
//
//   Money is stored in cents and shown as money. A price is never printed as
//   "1250" at somebody trying to read their own menu.
//
//   Nothing is invented. An empty column reads "Not set", never 0 or a
//   plausible default, and a page with no records says so plainly.
//
//   A field that points at another record gets a dropdown built from that
//   customer's own rows. Asking somebody to paste a UUID is not a form.

function text(value, fallback = "Not set") {
  const output = String(value == null ? "" : value).trim();
  return output || fallback;
}

// All three guarded with `Number.isFinite(Number(value))`, and Number(null) is
// 0. So a column with nothing in it rendered "$0.00", "0" or "0.0%" -- a
// confident figure standing in for an absent one, on twenty-three columns
// across the record pages. An unpriced service read as free, an uncounted item
// read as none in stock, and an invoice with no total read as nothing owed.
//
// A stored 0 still renders as 0, and that is the point: something wrote it.
// Absent and zero are different facts and the helpers can tell them apart.
function money(cents, currency = "usd") {
  const amount = finiteNumber(cents);
  if (amount === null) return "Not set";
  const symbol = String(currency || "usd").toLowerCase() === "usd" ? "$" : "";
  return `${symbol}${(amount / 100).toFixed(2)}`;
}

function quantity(value, unit) {
  const amount = finiteNumber(value);
  if (amount === null) return "Not counted";
  const unitText = String(unit || "").trim();
  return unitText ? `${amount} ${unitText}` : String(amount);
}

// Takes a fraction: 0.05 renders as 5.0%. That is the convention every
// numeric(7,4) percent column in migration 014 stores -- food_cost_percent,
// labor_cost_percent, target_food_cost_percent -- and recipe waste is stored
// the same way so this helper is right about all of them.
function percent(value) {
  const amount = finiteNumber(value);
  return amount === null ? "Not set" : `${(amount * 100).toFixed(1)}%`;
}

function day(value) {
  if (!value) return "Not set";
  return String(value).slice(0, 10);
}

function when(value) {
  if (!value) return "Not set";
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return "Not set";
  return parsed.toISOString().replace("T", " ").slice(0, 16);
}

function words(value, fallback = "Not set") {
  const output = String(value == null ? "" : value).trim();
  return output ? output.replaceAll("_", " ") : fallback;
}

function hours(row) {
  if (!row.clock_in_at || !row.clock_out_at) return "Still open";
  const start = new Date(String(row.clock_in_at));
  const end = new Date(String(row.clock_out_at));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "Not set";
  const minutes = (end - start) / 60000 - Number(row.break_minutes || 0);
  if (!Number.isFinite(minutes) || minutes < 0) return "Not set";
  return `${(minutes / 60).toFixed(2)} h`;
}

const ACTIVE_STATUSES = ["active", "inactive", "archived"];

const OWNER_RECORD_PAGES = Object.freeze([
  {
    path: "/business-builder/owner/locations",
    select: "address_line1,city,id,location_type,name,phone,region,status",
    api: "/api/business/locations",
    table: "business_locations",
    title: "Locations",
    body: "Every place you work from — storefronts, mobile stops, food trucks, trailers, job sites and service areas.",
    empty: "You have not added a location yet. Add your first one below.",
    columns: [
      { label: "Name", value: (row) => text(row.name, "Unnamed") },
      { label: "Kind", value: (row) => words(row.location_type) },
      { label: "Where", value: (row) => text([row.address_line1, row.city, row.region].filter(Boolean).join(", "), "No address") },
      { label: "Phone", value: (row) => text(row.phone, "None") },
      { label: "Status", value: (row) => words(row.status) }
    ],
    form: {
      legend: "Add a location",
      fields: [
        { name: "name", label: "Name", required: true, maxLength: 200 },
        { name: "location_type", label: "Kind", type: "select", options: ["storefront", "mobile", "job_site", "service_area", "warehouse"] },
        { name: "address_line1", label: "Address", maxLength: 200 },
        { name: "city", label: "Town or city", maxLength: 120 },
        { name: "region", label: "County or state", maxLength: 120 },
        { name: "postal_code", label: "Postcode", maxLength: 40 },
        { name: "phone", label: "Phone", maxLength: 40 }
      ]
    }
  },
  {
    path: "/business-builder/owner/services",
    select: "category,currency,duration_minutes,id,name,price_cents,status",
    api: "/api/business/services",
    table: "business_service_catalog",
    title: "Services",
    body: "What you sell — services, appointments and customer offers, with what each costs and how long it takes.",
    empty: "You have not added a service yet. Add your first one below.",
    columns: [
      { label: "Service", value: (row) => text(row.name, "Unnamed") },
      { label: "Category", value: (row) => text(row.category, "None") },
      { label: "Price", value: (row) => money(row.price_cents, row.currency) },
      { label: "Takes", value: (row) => (row.duration_minutes ? `${row.duration_minutes} min` : "Not set") },
      { label: "Status", value: (row) => words(row.status) }
    ],
    form: {
      legend: "Add a service",
      fields: [
        { name: "name", label: "Name", required: true, maxLength: 200 },
        { name: "category", label: "Category", maxLength: 120 },
        { name: "description", label: "Description", type: "textarea", maxLength: 2000 },
        { name: "price_cents", label: "Price in pence or cents", type: "number", hint: "1250 means £12.50 or $12.50." },
        { name: "duration_minutes", label: "How long it takes, in minutes", type: "number" },
        { name: "status", label: "Status", type: "select", options: ACTIVE_STATUSES }
      ]
    }
  },
  {
    path: "/business-builder/owner/bookings",
    select: "customer_email,customer_name,customer_phone,id,notes,starts_at,status",
    api: "/api/business/bookings",
    table: "business_bookings",
    shareableAs: "business_booking",
    shareNoun: "appointment",
    shareShows: "It shows the time and the status. It never shows the customer's name, email or phone, your notes, or who is assigned to it.",
    title: "Bookings",
    body: "Requested, confirmed, completed, cancelled and missed bookings, newest first.",
    empty: "No bookings yet.",
    columns: [
      { label: "Customer", value: (row) => text(row.customer_name, "Not named") },
      { label: "Contact", value: (row) => text(row.customer_email || row.customer_phone, "None") },
      { label: "Starts", value: (row) => when(row.starts_at) },
      { label: "Status", value: (row) => words(row.status) },
      { label: "Notes", value: (row) => text(row.notes, "None") }
    ],
    form: {
      legend: "Add a booking",
      fields: [
        { name: "customer_name", label: "Customer name", required: true, maxLength: 200 },
        { name: "customer_email", label: "Email", type: "email", maxLength: 200 },
        { name: "customer_phone", label: "Phone", maxLength: 40 },
        { name: "starts_at", label: "Starts", type: "datetime-local" },
        { name: "ends_at", label: "Ends", type: "datetime-local" },
        { name: "status", label: "Status", type: "select", options: ["requested", "confirmed", "completed", "cancelled", "no_show"] },
        { name: "notes", label: "Notes", type: "textarea", maxLength: 2000 }
      ]
    }
  },
  {
    path: "/business-builder/owner/staff",
    select: "display_name,email,employment_type,hire_date,id,job_title,phone,status",
    api: "/api/business/staff",
    table: "business_employee_profiles",
    title: "Staff",
    body: "The people who work for you, their job details and whether their access is active.",
    empty: "You have not added anybody yet.",
    columns: [
      { label: "Name", value: (row) => text(row.display_name, "Unnamed") },
      { label: "Job", value: (row) => text(row.job_title, "Not set") },
      { label: "Kind", value: (row) => words(row.employment_type) },
      { label: "Contact", value: (row) => text(row.email || row.phone, "None") },
      { label: "Started", value: (row) => day(row.hire_date) },
      { label: "Status", value: (row) => words(row.status) }
    ],
    form: {
      legend: "Add somebody",
      fields: [
        { name: "display_name", label: "Name", required: true, maxLength: 200 },
        { name: "job_title", label: "Job title", maxLength: 120 },
        { name: "employment_type", label: "Kind", type: "select", options: ["employee", "contractor", "temporary", "volunteer"] },
        { name: "email", label: "Email", type: "email", maxLength: 200 },
        { name: "phone", label: "Phone", maxLength: 40 },
        { name: "hire_date", label: "Start date", type: "date" }
      ]
    },
    // What each person is paid.
    //
    // employee_wage_rates has a schema, row level security and no page, which
    // is why labour cost is not computable anywhere in this product: hours are
    // recorded, rates are not. It blocks the daily profit figure that
    // /business-builder/owner/costs has been promising, and it is the reason
    // that page still says the calculation is not built.
    //
    // A rate belongs to a person and has a date it starts from, so it sits
    // here rather than on a page of its own -- the same relationship recipe
    // ingredients have to a recipe.
    lines: [{
      table: "employee_wage_rates",
      parentColumn: "employee_id",
      api: "/api/business/wage-rates",
      title: "What they are paid",
      empty: "No rate recorded for this person yet.",
      totalFrom: "amount_cents",
      columns: [
        { label: "Kind", value: (row) => words(row.rate_type) },
        { label: "Amount", value: (row) => money(row.amount_cents, row.currency) },
        { label: "From", value: (row) => day(row.effective_from) },
        { label: "Until", value: (row) => day(row.effective_to) },
        { label: "Status", value: (row) => words(row.status) }
      ],
      form: {
        legend: "Record a rate",
        fields: [
          { name: "rate_type", label: "Kind", type: "select", options: ["hourly", "salary", "commission", "stipend", "other"] },
          { name: "amount_cents", label: "Amount, in pence or cents", type: "number", required: true, hint: "1500 means £15.00 or $15.00 an hour for an hourly rate." },
          { name: "effective_from", label: "From", type: "date", required: true },
          { name: "effective_to", label: "Until, if it has an end", type: "date" }
        ]
      }
    }]
  },
  {
    path: "/business-builder/owner/schedules",
    select: "ends_at,id,notes,role_label,starts_at,status",
    api: "/api/business/schedules",
    table: "employee_schedules",
    title: "Schedule",
    body: "Who is working, where and when.",
    empty: "Nothing is scheduled yet.",
    columns: [
      { label: "Shift", value: (row) => text(row.role_label, "Shift") },
      { label: "Starts", value: (row) => when(row.starts_at) },
      { label: "Ends", value: (row) => when(row.ends_at) },
      { label: "Status", value: (row) => words(row.status) },
      { label: "Notes", value: (row) => text(row.notes, "None") }
    ],
    form: {
      legend: "Add a shift",
      fields: [
        { name: "employee_id", label: "Who", required: true, type: "reference", from: "staff" },
        { name: "starts_at", label: "Starts", type: "datetime-local", required: true },
        { name: "ends_at", label: "Ends", type: "datetime-local", required: true },
        { name: "role_label", label: "What they are doing", maxLength: 120 },
        { name: "notes", label: "Notes", type: "textarea", maxLength: 1000 }
      ]
    }
  },
  {
    path: "/business-builder/owner/time",
    select: "break_minutes,clock_in_at,clock_out_at,id,status",
    // Clocking in and out, which had endpoints and no way to press them.
    //
    // /api/business/time-entries/start and /stop have worked the whole time.
    // This page listed the entries and offered no form at all, so a business
    // could read its timesheets and never record one -- the whole feature was
    // reachable only by an API client.
    //
    // The form posts to /start rather than to the page's own list endpoint,
    // because clocking in is not "create a time entry with these values": the
    // server stamps the time. A form that let somebody type their own clock-in
    // time would be a different feature, and a worse one.
    form: {
      legend: "Clock in",
      action: "/api/business/time-entries/start",
      submitLabel: "Clock in now",
      fields: [
        { name: "employee_id", label: "Who is starting", type: "reference", from: "business_employee_profiles", required: true },
        { name: "location_id", label: "Where", type: "reference", from: "business_locations" },
        { name: "notes", label: "Note", maxLength: 500, hint: "Optional. What this shift is for." }
      ]
    },
    // Clocking out takes the entry in the body rather than the path, so the
    // action carries idField instead of a :id in its URL.
    rowAction: {
      api: "/api/business/time-entries/stop",
      idField: "id",
      label: "Clock out",
      columnLabel: "Clock out",
      reasonUnavailable: (row) => {
        const status = String(row?.status || "").toLowerCase();
        if (status !== "open") return status === "submitted" ? "Already clocked out" : `Not open (${status || "no status"})`;
        return null;
      }
    },
    api: "/api/business/time-entries",
    table: "employee_time_entries",
    title: "Time Clock",
    body: "Clock-ins and clock-outs as staff recorded them. Entries are started and stopped from the staff portal, not here.",
    empty: "No time has been recorded yet.",
    columns: [
      { label: "Clocked in", value: (row) => when(row.clock_in_at) },
      { label: "Clocked out", value: (row) => when(row.clock_out_at) },
      { label: "Break", value: (row) => `${Number(row.break_minutes || 0)} min` },
      { label: "Worked", value: (row) => hours(row) },
      { label: "Status", value: (row) => words(row.status) }
    ]
  },
  {
    path: "/business-builder/owner/inventory",
    select: "cost_cents,id,name,quantity,reorder_level,sku,status,unit",
    api: "/api/business/inventory",
    table: "inventory_items",
    title: "Inventory",
    body: "What you hold, how much of it, what it cost and when to reorder.",
    empty: "Nothing in stock yet.",
    columns: [
      { label: "Item", value: (row) => text(row.name, "Unnamed") },
      { label: "Code", value: (row) => text(row.sku, "None") },
      { label: "In stock", value: (row) => quantity(row.quantity, row.unit) },
      { label: "Reorder at", value: (row) => (row.reorder_level == null ? "Not set" : quantity(row.reorder_level, row.unit)) },
      { label: "Cost", value: (row) => money(row.cost_cents) },
      { label: "Status", value: (row) => words(row.status) }
    ],
    form: {
      legend: "Add an item",
      fields: [
        { name: "name", label: "Item", required: true, maxLength: 200 },
        { name: "sku", label: "Code", maxLength: 120 },
        { name: "category", label: "Category", maxLength: 120 },
        { name: "quantity", label: "How many", type: "number", step: "0.01" },
        { name: "unit", label: "Unit", maxLength: 40, hint: "each, kg, litre, box" },
        { name: "reorder_level", label: "Reorder when it drops to", type: "number", step: "0.01" },
        { name: "cost_cents", label: "Cost in pence or cents", type: "number" }
      ]
    }
  },
  {
    path: "/business-builder/owner/vendors",
    select: "account_number,contact_name,email,id,name,payment_terms,phone,status",
    api: "/api/business/vendors",
    table: "vendor_accounts",
    title: "Vendors",
    body: "Who you buy from, how to reach them and on what terms.",
    empty: "You have not added a vendor yet.",
    columns: [
      { label: "Vendor", value: (row) => text(row.name, "Unnamed") },
      { label: "Account", value: (row) => text(row.account_number, "None") },
      { label: "Contact", value: (row) => text(row.contact_name || row.email || row.phone, "None") },
      { label: "Terms", value: (row) => text(row.payment_terms, "Not set") },
      { label: "Status", value: (row) => words(row.status) }
    ],
    form: {
      legend: "Add a vendor",
      fields: [
        { name: "name", label: "Name", required: true, maxLength: 200 },
        { name: "account_number", label: "Account number", maxLength: 120 },
        { name: "contact_name", label: "Who you deal with", maxLength: 200 },
        { name: "email", label: "Email", type: "email", maxLength: 200 },
        { name: "phone", label: "Phone", maxLength: 40 },
        { name: "payment_terms", label: "Payment terms", maxLength: 120, hint: "30 days, on delivery" }
      ]
    }
  },
  {
    path: "/business-builder/owner/invoices",
    select: "currency,due_date,id,invoice_date,invoice_number,payment_status,processing_status,total_cents",
    api: "/api/business/invoices",
    table: "vendor_invoices",
    title: "Invoices",
    body: "Bills from your vendors, what they came to and whether they have been paid.",
    empty: "No invoices yet.",
    columns: [
      { label: "Invoice", value: (row) => text(row.invoice_number, "No number") },
      { label: "Dated", value: (row) => day(row.invoice_date) },
      { label: "Due", value: (row) => day(row.due_date) },
      { label: "Total", value: (row) => money(row.total_cents, row.currency) },
      { label: "Where it is", value: (row) => words(row.processing_status) },
      { label: "Paid", value: (row) => words(row.payment_status) }
    ],
    lines: {
      table: "vendor_invoice_lines",
      parentColumn: "invoice_id",
      api: "/api/business/receivable-lines",
      title: "What is on this invoice",
      empty: "No lines have been entered for this invoice yet.",
      totalFrom: "total_cost_cents",
      columns: [
        { label: "Item", value: (row) => text(row.item_name, "Unnamed") },
        { label: "Category", value: (row) => text(row.category, "None") },
        { label: "Quantity", value: (row) => quantity(row.quantity, row.unit) },
        { label: "Each", value: (row) => money(row.unit_cost_cents) },
        { label: "Line total", value: (row) => money(row.total_cost_cents) }
      ],
      form: {
        legend: "Add a line",
        fields: [
          { name: "item_name", label: "Item", required: true, maxLength: 200 },
          { name: "category", label: "Category", maxLength: 120 },
          { name: "quantity", label: "Quantity", type: "number" },
          { name: "unit", label: "Unit", maxLength: 40 },
          { name: "unit_cost_cents", label: "Cost each, in pence or cents", type: "number", hint: "1250 means £12.50 or $12.50." },
          { name: "total_cost_cents", label: "Line total, in pence or cents", type: "number" }
        ]
      }
    },
    form: {
      legend: "Add an invoice",
      fields: [
        { name: "vendor_id", label: "Vendor", required: true, type: "reference", from: "vendors" },
        { name: "invoice_number", label: "Invoice number", maxLength: 120 },
        { name: "invoice_date", label: "Invoice date", type: "date" },
        { name: "due_date", label: "Due date", type: "date" },
        { name: "total_cents", label: "Total in pence or cents", type: "number" },
        { name: "payment_status", label: "Paid", type: "select", options: ["unpaid", "scheduled", "paid", "disputed"] }
      ]
    }
  },
  {
    path: "/business-builder/owner/recipes",
    select: "category,id,name,status,yield_quantity,yield_unit",
    api: "/api/business/recipes",
    table: "recipe_cards",
    title: "Recipes",
    body: "How each dish or product is made, and how much it yields.",
    empty: "No recipes yet.",
    columns: [
      { label: "Recipe", value: (row) => text(row.name, "Unnamed") },
      { label: "Category", value: (row) => text(row.category, "None") },
      { label: "Makes", value: (row) => quantity(row.yield_quantity, row.yield_unit) },
      { label: "Status", value: (row) => words(row.status) }
    ],
    form: {
      legend: "Add a recipe",
      fields: [
        { name: "name", label: "Name", required: true, maxLength: 200 },
        { name: "category", label: "Category", maxLength: 120 },
        { name: "yield_quantity", label: "How much it makes", type: "number", step: "0.001" },
        { name: "yield_unit", label: "Unit", maxLength: 40, hint: "portions, litres, loaves" },
        { name: "instructions", label: "Method", type: "textarea", maxLength: 6000 }
      ]
    },
    // What is in it, and what that costs.
    //
    // recipe_cards shipped with a page and recipe_ingredients did not, so a
    // recipe was a name, a yield and a block of method text. Recipe costing --
    // the number a food business is actually buying, and what MarginEdge sells
    // at $350 a location -- needs the ingredients, and there was no way to add
    // one. docs/2026-08-12-WHAT-ELSE-CAN-WE-SELL.md names this table first for
    // that reason.
    lines: [{
      table: "recipe_ingredients",
      parentColumn: "recipe_id",
      api: "/api/business/recipe-ingredients",
      title: "What goes into it",
      empty: "Nothing has been added to this recipe yet.",
      totalFrom: "calculated_cost_cents",
      columns: [
        { label: "Ingredient", value: (row) => text(row.ingredient_name, "Not named") },
        { label: "Quantity", value: (row) => quantity(row.quantity, row.unit) },
        { label: "Cost per unit", value: (row) => money(row.unit_cost_cents) },
        { label: "Waste", value: (row) => percent(row.waste_percent) },
        { label: "Cost", value: (row) => money(row.calculated_cost_cents) }
      ],
      // calculated_cost_cents is not on the form. See the derive hook in
      // routes/sonara-last9-routes.cjs for why a computed column is asked for
      // once rather than twice.
      form: {
        legend: "Add an ingredient",
        fields: [
          { name: "ingredient_name", label: "Ingredient", required: true, maxLength: 200 },
          { name: "inventory_item_id", label: "From your stock", type: "reference", from: "inventory" },
          { name: "quantity", label: "How much", type: "number", step: "0.001", required: true },
          { name: "unit", label: "Unit", maxLength: 40, hint: "grams, ml, each" },
          { name: "unit_cost_cents", label: "Cost per unit, in pence or cents", type: "number", required: true, hint: "250 means £2.50 or $2.50 for one unit." },
          // Typed as a percentage and stored as a fraction, so 5 in this box
          // becomes 0.05 in the column. The first version of this stored the 5
          // and rendered it with percent(), which multiplies by 100 -- so a 5%
          // waste displayed as 500.0%. Writing "nothing read this column
          // before, so the convention is set here" was true about the column
          // and wrong about the codebase: every numeric(7,4) percent column in
          // migration 014 is a fraction, and percent() already knew that.
          //
          // The conversion is in derive below, so the customer types the number
          // they would say out loud and the column matches its neighbours.
          { name: "waste_percent", label: "Waste %", type: "number", step: "0.01", hint: "5 means 5% is lost in trimming or spillage. Leave blank for none." }
        ]
      },
      derive: (submitted) => {
        const quantityValue = finiteNumber(submitted.quantity);
        const unitCost = finiteNumber(submitted.unit_cost_cents);
        const waste = finiteNumber(submitted.waste_percent);
        // Both required fields are validated before this runs. A value that is
        // present and not a number would otherwise store NaN, and a blank one
        // would store a confident zero.
        if (quantityValue === null || unitCost === null) return {};
        const wasteMultiplier = waste !== null && waste > 0 ? 1 + waste / 100 : 1;
        const derived = { calculated_cost_cents: Math.round(quantityValue * unitCost * wasteMultiplier) };
        // Store the fraction the column's neighbours use, not the number typed.
        if (waste !== null && waste > 0) derived.waste_percent = waste / 100;
        return derived;
      }
    }],
    // The number the whole table exists to produce.
    //
    // A total ingredient cost is only half an answer: what a kitchen decides
    // with is the cost of one portion, which is that total over the recipe's
    // yield. It is stated only when it can be worked out, and says which part
    // is missing when it cannot -- a recipe with no yield recorded would
    // otherwise divide by zero and print Infinity.
    derivedCard: (recipe, childRows, ui) => {
      const listed = childRows[0];
      if (!listed || listed.ok !== true) {
        return ui.card("Cost per portion", "We could not read the ingredients just now, so this cannot be worked out.");
      }
      const rows = listed.rows;
      if (!rows.length) return ui.card("Cost per portion", "Add the ingredients below and this will work itself out.");
      const costs = rows.map((row) => finiteNumber(row.calculated_cost_cents));
      if (costs.some((cost) => cost === null)) {
        return ui.card("Cost per portion", "One of the ingredients has no cost recorded, so the total would be short by however many are blank.");
      }
      const total = costs.reduce((sum, cost) => sum + cost, 0);
      const yieldQuantity = finiteNumber(recipe?.yield_quantity);
      if (yieldQuantity === null || yieldQuantity <= 0) {
        return ui.card(
          "Cost per portion",
          `These ingredients cost ${money(total)} in total. Record how much this recipe makes and you will get the cost of one ${text(recipe?.yield_unit, "portion")}.`
        );
      }
      const unit = text(recipe?.yield_unit, "portion");
      return ui.card(
        "Cost per portion",
        `${money(total)} of ingredients over ${quantity(yieldQuantity, recipe?.yield_unit)} is ${money(Math.round(total / yieldQuantity))} per ${unit}. This is ingredients only \u2014 it does not include labour, energy or overheads.`
      );
    }
  },
  {
    path: "/business-builder/owner/menu",
    select: "currency,id,name,selling_price_cents,status,target_food_cost_percent,theoretical_cost_cents",
    api: "/api/business/menu-items",
    table: "menu_items",
    title: "Menu",
    body: "What you charge against what it costs you to make, so you can see the margin on each item.",
    empty: "Nothing on the menu yet.",
    columns: [
      { label: "Item", value: (row) => text(row.name, "Unnamed") },
      { label: "You charge", value: (row) => money(row.selling_price_cents, row.currency) },
      { label: "It costs", value: (row) => (finiteNumber(row.theoretical_cost_cents) ? money(row.theoretical_cost_cents, row.currency) : "Not costed yet") },
      {
        // theoretical_cost_cents is `integer default 0` and nothing writes it,
        // so every menu item a customer had entered read as costing nothing --
        // and this column reported the whole selling price as profit, at 100%,
        // on the screen a restaurant uses to decide what to charge.
        //
        // Zero is read as "never costed" rather than "free to make", which is
        // the same reading lib/sonara-record-checks.cjs already takes when it
        // flags a dish that has a price and no cost. A dish that genuinely
        // costs nothing is not a case a kitchen has; a dish nobody has costed
        // yet is the normal one.
        label: "You keep",
        value: (row) => {
          const price = finiteNumber(row.selling_price_cents);
          const cost = finiteNumber(row.theoretical_cost_cents);
          if (price === null || price <= 0) return "No price set";
          if (cost === null || cost === 0) return "Not costed yet";
          return `${money(price - cost, row.currency)} (${(((price - cost) / price) * 100).toFixed(0)}%)`;
        }
      },
      { label: "Target cost", value: (row) => percent(row.target_food_cost_percent) },
      { label: "Status", value: (row) => words(row.status) }
    ],
    form: {
      legend: "Add a menu item",
      fields: [
        { name: "name", label: "Name", required: true, maxLength: 200 },
        { name: "category", label: "Category", maxLength: 120 },
        { name: "selling_price_cents", label: "What you charge, in pence or cents", type: "number" },
        { name: "theoretical_cost_cents", label: "What it costs you, in pence or cents", type: "number" },
        { name: "recipe_id", label: "Recipe", type: "reference", from: "recipes" }
      ]
    }
  },
  {
    // A day's takings, and what sold.
    //
    // pos_sales_summaries and pos_menu_mix_items had a schema, row level
    // security, indexes and no page, which is why /business-builder/owner/costs
    // below listed a table nothing could ever fill. Nothing computes a profit
    // snapshot yet -- that needs labour as well, and is written up in
    // docs/2026-08-12-WHAT-ELSE-CAN-WE-SELL.md -- but the sales half of it is
    // now something a business can record.
    path: "/business-builder/owner/sales",
    select: "business_date,discounts_cents,gross_sales_cents,id,location_id,net_sales_cents,refunds_cents,source,tickets_count,tips_cents",
    api: "/api/business/sales-summaries",
    table: "pos_sales_summaries",
    title: "Daily sales",
    body: "What you took each day, and which items sold. This is what the food cost figures are worked out from.",
    empty: "No days recorded yet.",
    columns: [
      { label: "Day", value: (row) => day(row.business_date) },
      { label: "Net sales", value: (row) => money(row.net_sales_cents) },
      { label: "Discounts", value: (row) => money(row.discounts_cents) },
      { label: "Refunds", value: (row) => money(row.refunds_cents) },
      { label: "Tickets", value: (row) => quantity(row.tickets_count) },
      { label: "Where it came from", value: (row) => words(row.source, "Entered by hand") }
    ],
    form: {
      legend: "Record a day",
      fields: [
        { name: "business_date", label: "Day", type: "date", required: true },
        { name: "location_id", label: "Location", type: "reference", from: "locations" },
        { name: "gross_sales_cents", label: "Gross sales, in pence or cents", type: "number" },
        { name: "net_sales_cents", label: "Net sales, in pence or cents", type: "number", required: true },
        { name: "discounts_cents", label: "Discounts given", type: "number" },
        { name: "refunds_cents", label: "Refunds", type: "number" },
        { name: "tips_cents", label: "Tips", type: "number" },
        { name: "tickets_count", label: "How many tickets", type: "number" }
      ]
    },
    lines: [{
      table: "pos_menu_mix_items",
      parentColumn: "sales_summary_id",
      api: "/api/business/menu-mix",
      title: "What sold that day",
      empty: "Nothing recorded against this day yet.",
      totalFrom: "net_sales_cents",
      columns: [
        { label: "Item", value: (row) => text(row.item_name, "Not named") },
        { label: "Sold", value: (row) => quantity(row.quantity_sold) },
        { label: "Net sales", value: (row) => money(row.net_sales_cents) },
        // Not derived from the menu item's cost, deliberately. Doing that needs
        // a lookup at insert time and the derive hook sees only the submitted
        // body, so a half-built version would silently store zero -- which is
        // the same "0 means free to make" fault the menu page had. Asked for
        // until the lookup exists, and read as not costed when it is absent.
        { label: "Cost to make", value: (row) => (finiteNumber(row.theoretical_cost_cents) ? money(row.theoretical_cost_cents) : "Not costed") }
      ],
      form: {
        legend: "Add an item that sold",
        fields: [
          { name: "item_name", label: "Item", required: true, maxLength: 200 },
          { name: "menu_item_id", label: "From your menu", type: "reference", from: "menu" },
          { name: "quantity_sold", label: "How many sold", type: "number", step: "0.001", required: true },
          { name: "net_sales_cents", label: "Net sales for this item, in pence or cents", type: "number", required: true },
          { name: "theoretical_cost_cents", label: "What those cost you to make, in pence or cents", type: "number", hint: "Leave blank until the dish has been costed." }
        ]
      }
    }],
    // Hours and rates for this day, which are not children of a sales summary
    // and so cannot arrive through the child machinery.
    //
    // Time entries are filtered on the day in the query rather than in memory,
    // because a busy business has far more entries than days and reading them
    // all to keep one day's worth is how a page gets slow without anybody
    // noticing. Rates are read whole: there is one row per person per rate
    // change, so the table is small, and which one applies is a date
    // comparison this cannot express in PostgREST.
    derivedReads: async (day, scopedList) => {
      const businessDate = String(day?.business_date || "").slice(0, 10);
      if (!businessDate) return { entries: { ok: false, rows: [] }, rates: { ok: false, rows: [] } };
      const [entries, rates] = await Promise.all([
        scopedList("employee_time_entries", `&clock_in_at=gte.${businessDate}T00:00:00&clock_in_at=lte.${businessDate}T23:59:59`),
        scopedList("employee_wage_rates", "&status=eq.active")
      ]);
      return { entries, rates, businessDate };
    },

    // What the day made, from the two halves that are recordable.
    //
    // Net sales comes off the day itself; food cost is the menu mix. Labour is
    // the third input and is deliberately not in this figure: hours are on
    // employee_time_entries and rates are on employee_wage_rates, which are
    // two more queries than this page makes, and a "gross profit" that quietly
    // omits wages is worse than no figure at all in a business where labour is
    // the second-largest cost. The card says so rather than implying a
    // completeness it does not have.
    derivedCard: (day, childRows, ui, extra) => {
      const listed = childRows[0];
      const netSales = finiteNumber(day?.net_sales_cents);
      if (!listed || listed.ok !== true) {
        return ui.card("What this day made", "We could not read what sold, so the food cost cannot be worked out.");
      }
      if (netSales === null) {
        return ui.card("What this day made", "Record the net sales for this day and the food cost against it will work itself out.");
      }
      const rows = listed.rows;
      if (!rows.length) {
        return ui.card("What this day made", `Net sales were ${money(netSales)}. Add what sold below to see the food cost against it.`);
      }
      const costs = rows.map((row) => finiteNumber(row.theoretical_cost_cents));
      if (costs.some((cost) => cost === null)) {
        return ui.card(
          "What this day made",
          `Net sales were ${money(netSales)}. One of the items that sold has no cost recorded, so the food cost would be short by however many are blank.`
        );
      }
      const foodCost = costs.reduce((sum, cost) => sum + cost, 0);
      const share = netSales > 0 ? ` (${((foodCost / netSales) * 100).toFixed(1)}% of sales)` : "";
      const opening = `Net sales ${money(netSales)}, food cost ${money(foodCost)}${share}`;

      // Labour, when the hours and the rates can both be read. Everything this
      // cannot cost is named rather than treated as free -- see
      // lib/sonara-labour-cost.cjs for why each case exists.
      if (!extra || extra.entries?.ok !== true || extra.rates?.ok !== true) {
        return ui.card(
          "What this day made",
          `${opening}, leaving ${money(netSales - foodCost)} before labour. We could not read the hours or the pay rates just now, so labour is not in this figure.`
        );
      }
      const labour = labourCostForDay({ entries: extra.entries.rows, rates: extra.rates.rows, businessDate: extra.businessDate });
      if (!extra.entries.rows.length) {
        return ui.card(
          "What this day made",
          `${opening}, leaving ${money(netSales - foodCost)} before labour. Nobody recorded hours on this day, so there is no labour to take off.`
        );
      }
      if (labour.people === 0) {
        return ui.card(
          "What this day made",
          `${opening}, leaving ${money(netSales - foodCost)} before labour. ${labourGapSentence(labour)} Nothing on this day could be costed, so labour is not in the figure.`
        );
      }
      const left = netSales - foodCost - labour.costCents;
      const wording = labour.complete
        ? `${opening}, labour ${money(labour.costCents)} over ${labour.hours.toFixed(1)} hours, leaving ${money(left)}.`
        : `${opening}, labour at least ${money(labour.costCents)} over ${labour.hours.toFixed(1)} hours, leaving at most ${money(left)}. ${labourGapSentence(labour)}`;
      return ui.card("What this day made", `${wording} This is food and labour only -- rent, energy and everything else are not in it.`);
    }
  },
  {
    path: "/business-builder/owner/costs",
    select: "business_date,food_cost_cents,food_cost_percent,gross_profit_cents,id,labor_cost_cents,labor_cost_percent,net_sales_cents",
    api: null,
    table: "daily_profit_snapshots",
    title: "Food Costs",
    // The body said these were "worked out from your own records rather than
    // entered by hand" and the empty state said they "appear once you have
    // sales and costs recorded". Nothing writes daily_profit_snapshots -- grep
    // the runtime and this page is the only thing that names the table -- so
    // the figures would not have appeared however much a business recorded.
    // The page was a promise with nothing behind it.
    //
    // It is not deleted, because the table, the columns and the calculation are
    // all real work that is worth doing; what was wrong was telling a customer
    // it was already happening. The copy now says what is missing and where to
    // put the half of it that exists.
    body: "A day at a time: what you took, what it cost you and what was left. Each day works this out on itself under Daily sales, from your sales, what sold, your staff's hours and their pay rates. This page would hold the same figures saved as records, and nothing writes them yet.",
    empty: "Nothing saved here yet. Open a day under Daily sales and it works out its own food and labour cost; storing those as records is what is not built.",
    columns: [
      { label: "Day", value: (row) => day(row.business_date) },
      { label: "Sales", value: (row) => money(row.net_sales_cents) },
      { label: "Food", value: (row) => `${money(row.food_cost_cents)} (${percent(row.food_cost_percent)})` },
      { label: "Labour", value: (row) => `${money(row.labor_cost_cents)} (${percent(row.labor_cost_percent)})` },
      { label: "Left over", value: (row) => money(row.gross_profit_cents) }
    ]
  },
  {
    path: "/business-builder/owner/vehicles",
    select: "id,make,model,plate_number,registration_expires_at,status,vehicle_type,year",
    api: "/api/business/vehicles",
    table: "vehicle_records",
    title: "Vehicles",
    body: "Vehicles, trailers and food trucks, with registration and insurance dates so nothing lapses unnoticed.",
    empty: "No vehicles yet.",
    columns: [
      { label: "Vehicle", value: (row) => text([row.year, row.make, row.model].filter(Boolean).join(" "), "Not described") },
      { label: "Kind", value: (row) => words(row.vehicle_type) },
      { label: "Plate", value: (row) => text(row.plate_number, "None") },
      { label: "Registration ends", value: (row) => day(row.registration_expires_at) },
      { label: "Status", value: (row) => words(row.status) }
    ],
    form: {
      legend: "Add a vehicle",
      fields: [
        { name: "vehicle_type", label: "Kind", required: true, type: "select", options: ["vehicle", "trailer", "food_truck", "equipment"] },
        { name: "make", label: "Make", maxLength: 120 },
        { name: "model", label: "Model", maxLength: 120 },
        { name: "year", label: "Year", type: "number" },
        { name: "plate_number", label: "Plate", maxLength: 40 },
        { name: "registration_expires_at", label: "Registration ends", type: "date" }
      ]
    }
  },
  {
    path: "/business-builder/owner/maintenance",
    select: "cost_cents,currency,description,id,next_due_at,service_type,serviced_at,vendor",
    api: "/api/business/maintenance",
    table: "maintenance_logs",
    title: "Maintenance",
    body: "Work done on equipment, vehicles and premises, what it cost and when the next one is due.",
    empty: "Nothing logged yet.",
    columns: [
      { label: "What was done", value: (row) => text(row.description, "Not described") },
      { label: "Kind", value: (row) => words(row.service_type) },
      { label: "Who did it", value: (row) => text(row.vendor, "Not recorded") },
      { label: "Cost", value: (row) => money(row.cost_cents, row.currency) },
      { label: "Done", value: (row) => day(row.serviced_at) },
      { label: "Next due", value: (row) => day(row.next_due_at) }
    ],
    form: {
      legend: "Log maintenance",
      fields: [
        { name: "description", label: "What was done", required: true, maxLength: 500 },
        { name: "service_type", label: "Kind", maxLength: 120, hint: "service, repair, inspection" },
        { name: "vendor", label: "Who did it", maxLength: 200 },
        { name: "cost_cents", label: "Cost in pence or cents", type: "number" },
        { name: "serviced_at", label: "Date done", type: "date" },
        { name: "next_due_at", label: "Next due", type: "date" }
      ]
    }
  },
  // Which sources this business may research, and who said so.
  //
  // `research_sources` has carried `permission_status` since the platform
  // redesign, defaulting to 'needs_review'. Nothing read it and nothing wrote
  // it -- the table appeared only in the generated tenant-scope inventory and
  // one subsystem listing. A permission gate was designed into the schema and
  // never built, while /api/market-intelligence/fetch-source took any HTTPS URL
  // from a request body and had this server fetch it.
  //
  // Found while reviewing a scraping library. The order matters and is the
  // whole reason this page exists: adding a tool whose selling point is not
  // being detected, to a system that does not yet check whether it was allowed,
  // is the wrong way round.
  //
  // **The customer decides, not the owner.** They are the ones who know whether
  // they have a relationship with a supplier, whether a competitor's pricing
  // page is public, or whether a site is their own. An owner-approval queue
  // here would be this product asserting a judgement it is not in a position to
  // make about somebody else's business.
  {
    path: "/business-builder/owner/research-sources",
    select: "created_at,crawl_status,id,notes,permission_status,rate_limit_note,source_type,source_url",
    api: "/api/business/research-sources",
    table: "research_sources",
    title: "Sources you may research",
    body: "Sites you have established you may look at, and the ones nobody has ruled on yet. Market intelligence will only fetch a page for you from a source marked approved here.",
    empty: "You have not recorded a source yet. Add the first one below.",
    columns: [
      { label: "Source", value: (row) => text(row.source_url, "No address") },
      { label: "Kind", value: (row) => words(row.source_type) },
      { label: "May we research it", value: (row) => words(row.permission_status) },
      { label: "Repeat crawling", value: (row) => words(row.crawl_status) },
      { label: "Rate limits", value: (row) => text(row.rate_limit_note, "None recorded") },
      { label: "Added", value: (row) => when(row.created_at) }
    ],
    // Record pages create rows and never edit them, so without this a source
    // recorded before anybody had ruled on it would sit at needs_review for
    // good, and the only way to approve it would be to add the same site twice.
    // A gate whose only permitted answer is set at creation is a gate that
    // punishes anybody who was honest on the way in.
    rowAction: {
      api: "/api/business/research-sources/:id/approve",
      label: "Mark approved",
      columnLabel: "Approve",
      reasonUnavailable: (row) => {
        const status = String(row?.permission_status || "").toLowerCase();
        if (status === "approved") return "Approved";
        if (status === "declined") return "You declined this one";
        if (!row?.source_url) return "No address to research";
        return null;
      }
    },
    form: {
      legend: "Record a source",
      fields: [
        { name: "source_url", label: "Address", required: true, maxLength: 500, hint: "https://example.com \u2014 the whole site is covered, not just this page." },
        { name: "source_type", label: "What it is", required: true, type: "select", options: ["competitor", "supplier", "own_site", "directory", "publication", "other"] },
        // Three states, and the middle one is the point. A source nobody has
        // ruled on is not a source that was refused.
        { name: "permission_status", label: "May you research it", type: "select", options: ["needs_review", "approved", "declined"], hint: "Approved means you have established you may look at this site \u2014 it is public, it is yours, or you have their agreement." },
        { name: "crawl_status", label: "Repeat crawling", type: "select", options: ["disabled", "enabled"], hint: "Nothing crawls on a schedule yet. This records what you intend." },
        { name: "rate_limit_note", label: "Rate limits they ask for", maxLength: 500, hint: "Anything their robots.txt or terms say about how often." },
        { name: "notes", label: "Why you are researching it", type: "textarea", maxLength: 2000 }
      ]
    }
  },
  // Two tables written by API and shown on no page a customer could find.
  //
  // waste_logs was the clearer of the two: the endpoint existed, the columns
  // existed, and a row written through it was invisible from the moment it was
  // created. tests/form-reachability.test.js excused it with "a form without a
  // page to read the result on would be worse, not better" -- correct, and the
  // answer was the page rather than the exemption.
  //
  // It belongs beside recipes and daily sales because it is the third number in
  // the same sum. lib/sonara-formula-library.cjs already defines waste_cost
  // over waste_logs and inventory_items, and a kitchen that knows its food cost
  // and not its waste knows the smaller half of where the money went.
  {
    path: "/business-builder/owner/waste",
    select: "estimated_cost_cents,id,item_name,logged_at,quantity,reason,unit",
    api: "/api/business/waste",
    table: "waste_logs",
    title: "Waste",
    body: "What was thrown away, spilled, burnt or written off, and what it cost you.",
    empty: "You have not recorded any waste yet.",
    columns: [
      { label: "Item", value: (row) => text(row.item_name, "Unnamed") },
      { label: "How much", value: (row) => quantity(row.quantity, row.unit) },
      { label: "Cost", value: (row) => money(row.estimated_cost_cents) },
      { label: "Why", value: (row) => text(row.reason, "Not recorded") },
      { label: "When", value: (row) => when(row.logged_at) }
    ],
    form: {
      legend: "Record waste",
      fields: [
        { name: "item_name", label: "What was wasted", required: true, maxLength: 200 },
        { name: "inventory_item_id", label: "Stock item, if you track it", type: "reference", from: "inventory" },
        { name: "location_id", label: "Where", type: "reference", from: "locations" },
        { name: "quantity", label: "How much", type: "number" },
        { name: "unit", label: "Unit", maxLength: 40 },
        { name: "estimated_cost_cents", label: "What it cost, in pence or cents", type: "number", hint: "1250 means £12.50 or $12.50." },
        // Free text rather than a fixed list. "Spoiled", "dropped", "over-prepped"
        // and "customer returned" are different businesses' words for their own
        // problem, and a dropdown would be this product deciding which ones
        // count.
        { name: "reason", label: "Why", maxLength: 500, hint: "Spoiled, dropped, over-prepped, returned." },
        { name: "logged_at", label: "When", type: "datetime-local" }
      ]
    }
  },
  // The areas you cover. This one is not a table nothing displayed -- and the
  // reason recorded against it in tests/form-reachability.test.js said it was.
  //
  // "No page displays location_zones; only the generic list and insert exist"
  // was false when it was written or became false afterwards:
  // /business-builder/routes has listed them the whole time, and its empty
  // state read "Add the areas you cover and they will appear here" while
  // offering no way to add one. A wrong reason inside an exemption is worse
  // than no exemption, because it is the thing the next person reads instead of
  // checking.
  //
  // The routes page redirects here now, on the precedent already set for
  // vehicles: one page per kind of record, rather than a second view that can
  // drift from the first.
  {
    path: "/business-builder/owner/areas",
    select: "id,latitude,longitude,name,radius_meters,status,zone_type",
    api: "/api/location/zones",
    table: "location_zones",
    title: "Areas you cover",
    // Deliberately says what a zone does and does not do: no dispatch, no
    // background tracking, and a staff check-in names an area only when the
    // person checking in says so.
    //
    // Worded around "nothing is", which the outage crawl reads as a claim about
    // the customer's records -- "nothing is tracked in the background" would be
    // on screen while every read was failing. The same rewrite the
    // accounting-exports and device-cues copy needed.
    body: "An area is a name for somewhere you deliver to, work in or check in at. It dispatches nobody and follows nobody; it is used when a person records being there.",
    empty: "You have not added an area yet. Add your first one below.",
    columns: [
      { label: "Area", value: (row) => text(row.name, "Unnamed") },
      { label: "Kind", value: (row) => words(row.zone_type) },
      // Two columns rather than one, and each says "Not set" on its own. A
      // single "Where" reading "53.79, Not set" would be a coordinate that is
      // not one.
      { label: "Latitude", value: (row) => text(row.latitude, "Not set") },
      { label: "Longitude", value: (row) => text(row.longitude, "Not set") },
      { label: "How far around it", value: (row) => (finiteNumber(row.radius_meters) === null ? "Not set" : `${finiteNumber(row.radius_meters)} m`) },
      { label: "Status", value: (row) => words(row.status) }
    ],
    form: {
      legend: "Add an area",
      fields: [
        { name: "name", label: "What to call it", required: true, maxLength: 200 },
        { name: "location_id", label: "Which of your locations it belongs to", type: "reference", from: "locations" },
        { name: "zone_type", label: "Kind", type: "select", options: ["business", "job_site", "delivery_area", "event", "restricted", "custom"] },
        // numeric(10,7) in migration 015, so the step matches the column rather
        // than rounding a customer's coordinate on the way in.
        { name: "latitude", label: "Latitude", type: "number", step: "0.0000001", hint: "Optional. Leave both blank if you only want the name." },
        { name: "longitude", label: "Longitude", type: "number", step: "0.0000001" },
        { name: "radius_meters", label: "How far around it, in metres", type: "number" },
        { name: "status", label: "Status", type: "select", options: ACTIVE_STATUSES }
        // polygon_geojson is deliberately not asked for. Pasting GeoJSON into a
        // text box is not a form, and nothing in this application draws a
        // polygon or reads one.
      ]
    }
  }
]);

// Creator Studio's record pages. They live beside the Business Builder ones
// because they are rendered by the same code and follow the same rules; the
// route file gives them their own heading and links.
//
// The first two shipped as three cards describing what they would show, the
// same way the owner pages did, while the tables behind them already existed.
//
// The last five are the artist system: creator_artist_profiles and the four
// tables that hang off it. Migration 016 created eight tables with row level
// security and indexes; routes/creator-artist-system-routes.cjs was the only
// code that read five of them, server.js never required it, and it was deleted.
// lib/sonara-orphan-tables.cjs recorded the choice that left -- build the
// workspace properly from the real columns, or drop the tables -- and this is
// the first of those.
//
// "From the real columns" is the part that matters. The deleted module rendered
// a hardcoded artist nobody had created; these read migration 016 and offer the
// columns it actually has. Three column types are deliberately absent from the
// forms: the jsonb rule blocks (private_backstory, voice_identity, genre_blend,
// writing_rules, visual_rules, prompt_rules, scene_plan, shot_rules) because a
// text input posting into a jsonb column produces a save that fails or a shape
// nothing can read; keys_allowed because it is text[] and the same applies; and
// creator_video_treatments.track_id because a track picker belongs on a page
// that has tracks on it.
const CREATOR_RECORD_PAGES = Object.freeze([
  {
    path: "/creator-studio/music-projects",
    select: "artist_name,bpm,id,musical_key,project_type,status,title",
    api: "/api/creator/music-projects",
    table: "music_projects",
    title: "Music projects",
    body: "Songs, albums, EPs and sessions you are working on.",
    empty: "You have not started a project yet. Add your first one below.",
    columns: [
      { label: "Title", value: (row) => text(row.title, "Untitled") },
      { label: "Artist", value: (row) => text(row.artist_name, "Not set") },
      { label: "Kind", value: (row) => words(row.project_type) },
      { label: "Tempo", value: (row) => (row.bpm ? `${row.bpm} bpm` : "Not set") },
      { label: "Key", value: (row) => text(row.musical_key, "Not set") },
      { label: "Where it is", value: (row) => words(row.status) }
    ],
    form: {
      legend: "Start a project",
      fields: [
        { name: "title", label: "Title", required: true, maxLength: 200 },
        { name: "artist_name", label: "Artist", maxLength: 200 },
        { name: "project_type", label: "Kind", type: "select", options: ["song", "album", "ep", "single", "session"] },
        { name: "bpm", label: "Tempo in bpm", type: "number" },
        { name: "musical_key", label: "Key", maxLength: 40, hint: "C minor, F# major" }
      ]
    }
  },
  {
    path: "/creator-studio/device-cues",
    select: "duration_ms,event_name,id,name,sound_type,status",
    api: "/api/sensory/sound-cues",
    table: "sound_cues",
    title: "Sound and motion cues",
    // AGENTS.md: sounds, haptics and motion are off or explicitly user-controlled
    // by default. That part was always stated here. The rest of the sentence was
    // not true.
    //
    // It read "a cue only runs when something you do asks for it and your device
    // allows it", which says a cue runs. Nothing reads either of these tables.
    // `grep` for sound_cues and haptic_patterns across server.js, routes/ and
    // lib/ finds the record page, the generic insert and no consumer, and the
    // sound and vibration this application does produce come from a hardcoded
    // map of five kinds in public/sensory-device-client.js — success, error,
    // warning, tap, complete — which never looks a row up.
    //
    // So the page said the customer's own cue would fire when they did
    // something, and it would not. The copy states what these rows are now: a
    // record of the design, kept until something plays them.
    body: "Cues you have written down for your own projects. Writing one down does not make it play — SONARA does not yet read these definitions. The sound and vibration the app itself makes are the built-in ones on the device feedback page, and those stay off until you turn them on.",
    empty: "You have not defined any sound cues yet.",
    columns: [
      { label: "Cue", value: (row) => text(row.name, "Unnamed") },
      { label: "Fires on", value: (row) => words(row.event_name) },
      { label: "Kind", value: (row) => words(row.sound_type) },
      { label: "Length", value: (row) => (row.duration_ms ? `${row.duration_ms} ms` : "Not set") },
      { label: "Status", value: (row) => words(row.status) }
    ],
    form: {
      legend: "Add a sound cue",
      fields: [
        { name: "cue_key", label: "Short name", required: true, maxLength: 100, hint: "save_success, upload_done" },
        { name: "name", label: "What to call it", required: true, maxLength: 200 },
        { name: "event_name", label: "What it fires on", required: true, maxLength: 200 },
        { name: "sound_type", label: "Kind", type: "select", options: ["tone", "sample", "notification"] },
        { name: "duration_ms", label: "Length in milliseconds", type: "number" }
      ]
    },
    also: [
      {
        table: "haptic_patterns",
        select: "accessibility_notes,event_name,id,name,status",
        api: "/api/sensory/haptic-patterns",
        title: "Vibration patterns",
        // The empty text used to be "You have not defined any vibration patterns
        // yet", which told a customer they simply had not got round to it. They
        // could not: no `also` block in this file carried a create form, and the
        // page's one form makes sound cues. So it was corrected to say the door
        // did not exist — and now the door does, because `also` blocks take a
        // form.
        //
        // Adding it was checked against the thing that makes a form worth having
        // rather than assumed. Nothing plays either table, so this is a record
        // of a design and not a switch, and both this text and the page body say
        // so. The sound cue form beside it has always been in exactly the same
        // position; the difference until now was that one of the two had a way
        // in and the other did not.
        empty: "You have not written down a vibration pattern yet. Writing one down does not make it play; it is the design, kept until something reads it.",
        columns: [
          { label: "Pattern", value: (row) => text(row.name, "Unnamed") },
          { label: "Fires on", value: (row) => words(row.event_name) },
          { label: "Notes", value: (row) => text(row.accessibility_notes, "None") },
          { label: "Status", value: (row) => words(row.status) }
        ],
        form: {
          legend: "Write down a vibration pattern",
          fields: [
            { name: "pattern_key", label: "Short name", required: true, maxLength: 100, hint: "save_success, upload_done" },
            { name: "name", label: "What to call it", required: true, maxLength: 200 },
            { name: "event_name", label: "What it would fire on", required: true, maxLength: 200 },
            // Asked for because a pattern nobody can feel is a pattern somebody
            // has to be told about in words. AGENTS.md keeps haptics behind an
            // explicit user control for the same reason: it is feedback a
            // person may never receive.
            { name: "accessibility_notes", label: "What it should feel like, in words", type: "textarea", maxLength: 1000, hint: "For anyone who cannot feel it, or who has vibration turned off." },
            { name: "status", label: "Status", type: "select", options: ACTIVE_STATUSES }
          ]
        }
      },
      // The parent of the whole family, and the last of the three device tables
      // that had an insert endpoint and no surface.
      //
      // A profile is a named set of answers: whether this way of working uses
      // sound, vibration, motion or location, and which accessibility mode it
      // assumes. Nothing reads it, the same as the two lists above it, and the
      // page body says so once for all three.
      {
        table: "sensory_feedback_profiles",
        select: "accessibility_mode,id,location_enabled,motion_enabled,name,profile_key,sound_enabled,status,vibration_enabled",
        api: "/api/sensory/profiles",
        title: "Feedback profiles",
        empty: "You have not written down a feedback profile yet.",
        columns: [
          { label: "Profile", value: (row) => text(row.name, "Unnamed") },
          { label: "Accessibility", value: (row) => words(row.accessibility_mode) },
          // Four booleans as one column of what is on, because four columns
          // reading "Yes/No/No/No" is a table nobody scans. "Nothing" rather
          // than an empty cell: all four off is an answer, not a blank.
          //
          // A column that is absent is not a column that is false, so an
          // unreadable row says so rather than reporting everything off.
          { label: "Uses", value: (row) => {
            const known = ["sound_enabled", "vibration_enabled", "motion_enabled", "location_enabled"].filter((key) => row[key] !== undefined && row[key] !== null);
            if (!known.length) return "Not set";
            const on = known.filter((key) => row[key] === true).map((key) => key.replace("_enabled", ""));
            return on.length ? on.join(", ") : "Nothing";
          } },
          { label: "Status", value: (row) => words(row.status) }
        ],
        form: {
          legend: "Write down a feedback profile",
          fields: [
            { name: "name", label: "What to call it", required: true, maxLength: 200 },
            { name: "profile_key", label: "Short name", required: true, maxLength: 100, hint: "Has to be different from your other profiles'." },
            { name: "description", label: "What it is for", type: "textarea", maxLength: 1000 },
            // All four offered as an explicit choice, and all four default to
            // off. AGENTS.md keeps sound, haptics and alerts off or explicitly
            // user-controlled by default; migration 015 gives two of these
            // columns a database default of true, so leaving them unasked was
            // the one arrangement that could not satisfy the rule.
            { name: "sound_enabled", label: "Uses sound", type: "select", options: [{ value: "false", label: "No" }, { value: "true", label: "Yes" }] },
            { name: "vibration_enabled", label: "Uses vibration", type: "select", options: [{ value: "false", label: "No" }, { value: "true", label: "Yes" }] },
            { name: "motion_enabled", label: "Uses motion", type: "select", options: [{ value: "false", label: "No" }, { value: "true", label: "Yes" }] },
            { name: "location_enabled", label: "Uses location", type: "select", options: [{ value: "false", label: "No" }, { value: "true", label: "Yes" }] },
            { name: "accessibility_mode", label: "Accessibility mode", type: "select", options: ["standard", "reduced_motion", "silent", "high_contrast", "custom"] },
            { name: "status", label: "Status", type: "select", options: ACTIVE_STATUSES }
          ]
        }
      }
    ]
  },

  // The artist system. creator_artist_profiles is the parent; the four below
  // reference it, which is why each of their forms opens with a picker and why
  // artist_profile_id is required on all four -- migration 016 cascades a
  // delete from the profile, so a row without one is a row nothing owns.
  {
    path: "/creator-studio/artists",
    select: "artist_key,artist_name,id,public_description,status",
    api: "/api/creator/artists",
    table: "creator_artist_profiles",
    publishHandle: true,
    title: "Artist identities",
    body: "The artists you release as. Each one holds its own sound, its own release cycles and its own prompt rules, so work under one name stays separate from work under another.",
    empty: "You have not set up an artist yet. Add your first one below.",
    columns: [
      { label: "Artist", value: (row) => text(row.artist_name, "Unnamed") },
      { label: "Short name", value: (row) => text(row.artist_key, "Not set") },
      { label: "Description", value: (row) => text(row.public_description, "None") },
      { label: "Status", value: (row) => words(row.status) }
    ],
    form: {
      legend: "Add an artist",
      fields: [
        { name: "artist_name", label: "Artist name", required: true, maxLength: 200 },
        { name: "artist_key", label: "Short name", required: true, maxLength: 100, hint: "Lowercase, no spaces. Used to keep this artist's records together, and it has to be different from your other artists'." },
        { name: "public_description", label: "Description", type: "textarea", maxLength: 1000, hint: "What this artist is, in your words. Shown to you, not published anywhere." },
        { name: "status", label: "Status", type: "select", options: ["active", "paused", "archived"] }
      ]
    }
  },
  {
    path: "/creator-studio/sound-identity",
    select: "bpm_range,drum_language,harmonic_identity,id,name,profile_key,status,vocal_mode",
    api: "/api/creator/sound-identity",
    table: "creator_sonic_profiles",
    title: "Sound identity",
    body: "What an artist sounds like, written down: tempo, drums, harmony and voice. Keeping it here is what lets two releases a year apart still sound like the same act.",
    empty: "No sound identity recorded yet. Describe one below.",
    columns: [
      { label: "Name", value: (row) => text(row.name, "Unnamed") },
      { label: "Short name", value: (row) => text(row.profile_key, "Not set") },
      { label: "Tempo", value: (row) => text(row.bpm_range, "Not set") },
      { label: "Drums", value: (row) => text(row.drum_language, "Not set") },
      { label: "Harmony", value: (row) => text(row.harmonic_identity, "Not set") },
      { label: "Voice", value: (row) => text(row.vocal_mode, "Not set") },
      { label: "Status", value: (row) => words(row.status) }
    ],
    form: {
      legend: "Describe a sound",
      fields: [
        { name: "artist_profile_id", label: "Artist", required: true, type: "reference", from: "artists" },
        { name: "name", label: "What to call it", required: true, maxLength: 200 },
        { name: "profile_key", label: "Short name", required: true, maxLength: 100, hint: "Different from this artist's other sounds." },
        { name: "bpm_range", label: "Tempo range", maxLength: 60, hint: "82-96" },
        { name: "drum_language", label: "Drums", maxLength: 200 },
        { name: "harmonic_identity", label: "Harmony", maxLength: 200 },
        { name: "vocal_mode", label: "Voice", maxLength: 200 },
        { name: "mix_notes", label: "Mix notes", type: "textarea", maxLength: 1000 },
        { name: "avoid_notes", label: "What to avoid", type: "textarea", maxLength: 1000 }
      ]
    }
  },
  {
    path: "/creator-studio/album-cycles",
    select: "concept_summary,id,project_type,release_status,slug,target_release_date,title",
    api: "/api/creator/album-cycles",
    table: "creator_album_cycles",
    title: "Album and release cycles",
    body: "A single, EP, album or campaign, and where it has got to. The tracks, videos and release tasks you already keep hang off one of these.",
    empty: "No cycles yet. Start one below.",
    columns: [
      { label: "Title", value: (row) => text(row.title, "Untitled") },
      { label: "Kind", value: (row) => words(row.project_type) },
      { label: "Where it is", value: (row) => words(row.release_status) },
      { label: "Target date", value: (row) => day(row.target_release_date) },
      { label: "Concept", value: (row) => text(row.concept_summary, "None") }
    ],
    form: {
      legend: "Start a cycle",
      fields: [
        { name: "artist_profile_id", label: "Artist", required: true, type: "reference", from: "artists" },
        { name: "title", label: "Title", required: true, maxLength: 200 },
        { name: "slug", label: "Short name", required: true, maxLength: 120, hint: "Lowercase, no spaces. Different from this artist's other cycles." },
        { name: "project_type", label: "Kind", type: "select", options: ["single", "ep", "album", "deluxe", "mixtape", "video_project", "campaign", "other"] },
        { name: "target_release_date", label: "Target release date", type: "date" },
        { name: "concept_summary", label: "Concept", type: "textarea", maxLength: 2000 },
        { name: "visual_direction", label: "Visual direction", type: "textarea", maxLength: 2000 }
      ]
    }
  },
  {
    path: "/creator-studio/prompt-blueprints",
    select: "blueprint_key,id,max_characters,name,purpose,status",
    api: "/api/creator/prompt-blueprints",
    table: "creator_prompt_blueprints",
    title: "Prompt blueprints",
    // Not a second prompt library, and the difference is worth being plain
    // about because it is not obvious. The Prompt Library at
    // /creator-studio/prompts stores prompts with versions, provenance and
    // licence status -- it is where a prompt lives. A blueprint is a rule for
    // one artist: which fields a track has to have filled in before a prompt is
    // written from it, and how long the result may be. The library has no
    // column for either, which is why this is not a view onto it.
    body: "A rule for one artist: what a track needs before you write a prompt from it, and how long the prompt may be. Your prompts themselves live in the Prompt Library. Written by you and stored for you \u2014 we do not send any of it anywhere until you use it somewhere that says it will.",
    empty: "No blueprints yet. Write one below.",
    columns: [
      { label: "Name", value: (row) => text(row.name, "Unnamed") },
      { label: "Short name", value: (row) => text(row.blueprint_key, "Not set") },
      { label: "What it is for", value: (row) => text(row.purpose, "Not set") },
      { label: "Character limit", value: (row) => quantity(row.max_characters, "characters") },
      { label: "Status", value: (row) => words(row.status) }
    ],
    form: {
      legend: "Write a blueprint",
      fields: [
        { name: "artist_profile_id", label: "Artist", required: true, type: "reference", from: "artists" },
        { name: "name", label: "What to call it", required: true, maxLength: 200 },
        { name: "blueprint_key", label: "Short name", required: true, maxLength: 100, hint: "Different from this artist's other blueprints." },
        { name: "purpose", label: "What it is for", maxLength: 300 },
        { name: "prompt_template", label: "The pattern", type: "textarea", required: true, maxLength: 4000, hint: "Your own words. Do not paste anybody else's lyrics or copy." },
        { name: "negative_prompt_rules", label: "What to keep out", type: "textarea", maxLength: 2000 },
        { name: "max_characters", label: "Character limit", type: "number", hint: "How long a finished prompt may be. 1000 if you leave it blank." }
      ]
    }
  },
  {
    path: "/creator-studio/video-treatments",
    select: "concept,duration_seconds,id,platform_target,status,sync_notes,title",
    api: "/api/creator/video-treatments",
    table: "creator_video_treatments",
    title: "Video treatments",
    body: "What a video is meant to be before anybody shoots it: the idea, how long, and where it is going.",
    empty: "No treatments yet. Write one below.",
    columns: [
      { label: "Title", value: (row) => text(row.title, "Untitled") },
      { label: "For", value: (row) => words(row.platform_target) },
      { label: "Length", value: (row) => (row.duration_seconds ? `${row.duration_seconds} seconds` : "Not set") },
      { label: "Concept", value: (row) => text(row.concept, "None") },
      { label: "Sound and picture", value: (row) => text(row.sync_notes, "None") },
      { label: "Status", value: (row) => words(row.status) }
    ],
    form: {
      legend: "Write a treatment",
      fields: [
        { name: "artist_profile_id", label: "Artist", required: true, type: "reference", from: "artists" },
        { name: "title", label: "Title", required: true, maxLength: 200 },
        { name: "platform_target", label: "Where it is going", type: "select", options: ["social", "youtube", "shorts", "reels", "tiktok", "music_video", "commercial", "other"] },
        { name: "duration_seconds", label: "Length in seconds", type: "number" },
        { name: "concept", label: "Concept", type: "textarea", maxLength: 2000 },
        { name: "sync_notes", label: "Sound and picture notes", type: "textarea", maxLength: 2000 }
      ]
    }
  }
]);

// A form field can point at another of these pages ("reference"), and the
// dropdown is filled from that page's own records.
const REFERENCE_SOURCES = Object.freeze({
  staff: { table: "business_employee_profiles", label: (row) => row.display_name || row.employee_number || row.id },
  vendors: { table: "vendor_accounts", label: (row) => row.name || row.account_number || row.id },
  recipes: { table: "recipe_cards", label: (row) => row.name || row.id },
  locations: { table: "business_locations", label: (row) => row.name || row.id },
  customers: { table: "customers", label: (row) => row.name || row.email || row.id },
  services: { table: "business_service_catalog", label: (row) => row.name || row.id },
  // Added for recipe ingredients. A `from:` naming no source here renders an
  // empty select rather than failing, so the control looks present and offers
  // nothing -- tests/owner-record-lines.test.js now refuses an unknown source
  // for that reason.
  inventory: { table: "inventory_items", label: (row) => row.name || row.sku || row.id },
  menu: { table: "menu_items", label: (row) => row.name || row.id },
  // The artist system's four child pages all pick a parent from here.
  artists: { table: "creator_artist_profiles", label: (row) => row.artist_name || row.artist_key || row.id },
  // The one source that cannot label itself.
  //
  // A variant row says "Large", "Blue", "Box of 12". Every other source here
  // holds a name that means something on its own; this one holds the half of a
  // name that does not, and a dropdown offering three different products'
  // "Large" is a control that looks like a choice and is not one.
  //
  // `select` exists for this. PostgREST embeds the parent through the foreign
  // key, so the option can say which product the version belongs to. It is
  // optional and defaults to "*", so the eight sources above are unchanged.
  productVariants: {
    table: "merchant_product_variants",
    select: "*,merchant_products(name)",
    label: (row) => {
      const product = String(row.merchant_products?.name || "").trim();
      const version = String(row.variant_name || "").trim();
      // No invented product name. If the embed did not come back, the option
      // falls to its code and then to the framework's id -- unhelpful, but not
      // a bare adjective presented as though it identified something.
      if (!product) return String(row.sku || "").trim();
      return version ? `${product} \u2014 ${version}` : product;
    }
  }
});

// Three tables that had a schema, row level security, indexes and no way in.
//
// purchase_orders, inventory_count_sessions and location_transfers were among
// the tables docs/WORKSPACE_WORKFLOW_AUDIT.md counted as never named by the
// application. Unlike most of that list they are not superseded by anything and
// not part of an unbuilt subsystem: they are ordinary operations for a business
// that holds stock, and they sit directly beside inventory and vendors, which
// customers already have.
//
// Each is the parent of a lines table -- purchase_order_lines,
// inventory_count_lines, location_transfer_lines. Those are not workspaces of
// their own and do not get pages here; a line belongs inside the order or count
// it is part of, and a standalone "add a line" form detached from its parent
// would be a way to create orphaned rows.
const OPERATIONS_RECORD_PAGES = Object.freeze([
  {
    path: "/business-builder/owner/payments-made",
    select: "amount_cents,currency,id,paid_at,payment_reference,scheduled_for,status",
    api: "/api/business/bill-payments",
    table: "bill_payment_records",
    title: "Payments to suppliers",
    body: "What you have paid your suppliers, what is scheduled, and what has not gone through.",
    empty: "You have not recorded a supplier payment yet. Add your first one below.",
    columns: [
      { label: "Amount", value: (row) => money(row.amount_cents, row.currency) },
      { label: "Status", value: (row) => words(row.status) },
      { label: "Due", value: (row) => day(row.scheduled_for) },
      { label: "Paid", value: (row) => when(row.paid_at) },
      { label: "Reference", value: (row) => text(row.payment_reference, "None") }
    ],
    form: {
      legend: "Record a payment",
      fields: [
        { name: "vendor_id", label: "Supplier", type: "reference", from: "vendors" },
        { name: "amount_cents", label: "Amount in pence or cents", type: "number", hint: "1250 means £12.50 or $12.50." },
        { name: "currency", label: "Currency", maxLength: 20 },
        { name: "scheduled_for", label: "Due date", type: "date" },
        { name: "paid_at", label: "When it was paid", type: "datetime-local" },
        { name: "status", label: "Status", type: "select", options: ["scheduled", "paid", "failed", "cancelled", "void"] },
        { name: "payment_reference", label: "Reference", maxLength: 200 }
      ]
    }
  },
  {
    path: "/business-builder/owner/accounting-exports",
    select: "created_at,error_message,export_type,id,period_end,period_start,provider_key,status",
    api: "/api/business/accounting-exports",
    table: "accounting_exports",
    title: "Accounting exports",
    // Was "Batches of your records prepared for an accountant or accounting
    // software, and whether each one finished." Nothing prepared a batch and
    // nothing finished: file_url had no writer and status never left "queued",
    // so a column headed with that promise had an answer that could never
    // change. The file is built when it is downloaded now, and the copy says
    // that rather than implying a worker that does not exist.
    // "so nothing sits here waiting to be processed" was the first wording, and
    // the outage crawl rejected it: "nothing sits here" reads as a claim that
    // the customer has no exports, which is exactly what a page must not say
    // while its reads are failing. It was ambiguous rather than wrong, and
    // rewording beat adding it to the exemption list.
    body: "Periods you have asked to export. Each file is built at the moment you download it, rather than prepared in advance.",
    empty: "You have not asked for an export yet.",
    columns: [
      { label: "What", value: (row) => words(row.export_type) },
      { label: "Period", value: (row) => `${day(row.period_start)} to ${day(row.period_end)}` },
      // "Status" on the other seven pages tracks something that moves. Here
      // nothing advances it, so it is labelled as what it is -- a record of
      // what was asked for -- rather than as progress towards a file.
      { label: "Asked for", value: (row) => words(row.status) },
      { label: "Sent to", value: (row) => words(row.provider_key, "Not sent anywhere") },
      // file_url is a storage link and payload is a blob; neither belongs in a
      // table cell. The problem is what the reader needs when it failed.
      { label: "Problem", value: (row) => text(row.error_message, "None") },
      { label: "Prepared", value: (row) => when(row.created_at) }
    ],
    form: {
      legend: "Prepare an export",
      fields: [
        // The options ARE the keys of the source table, not a list beside it.
        // This offered six for as long as the page existed while the download
        // route could build three, so three of the six were a choice that
        // ended in a 422 after the customer had already made it.
        { name: "export_type", label: "What to export", type: "select", options: [...ACCOUNTING_EXPORT_TYPES] },
        { name: "period_start", label: "From", type: "date" },
        { name: "period_end", label: "To", type: "date" },
        { name: "provider_key", label: "Accounting software, if any", maxLength: 100 }
      ]
    }
  },
  {
    path: "/business-builder/owner/purchase-orders",
    select: "created_at,currency,expected_at,id,notes,po_number,status,total_cents",
    api: "/api/business/purchase-orders",
    table: "purchase_orders",
    title: "Purchase orders",
    body: "What you have ordered from suppliers, what it should cost, and whether it has arrived.",
    empty: "You have not raised a purchase order yet. Add your first one below.",
    columns: [
      { label: "Order", value: (row) => text(row.po_number, "No number") },
      { label: "Status", value: (row) => words(row.status) },
      { label: "Expected", value: (row) => day(row.expected_at) },
      { label: "Total", value: (row) => money(row.total_cents, row.currency) },
      { label: "Notes", value: (row) => text(row.notes, "None") },
      { label: "Raised", value: (row) => when(row.created_at) }
    ],
    // What was actually ordered. A purchase order with no lines is a number
    // with nothing behind it, which is why the parent page alone was not the
    // feature. purchase_order_lines was classified "build-with-parent" in
    // lib/sonara-orphan-tables.cjs for exactly this reason: a line detached
    // from its order is an orphaned row, so it is reachable only through the
    // order it belongs to.
    lines: {
      table: "purchase_order_lines",
      parentColumn: "purchase_order_id",
      api: "/api/business/purchase-order-lines",
      title: "What was ordered",
      empty: "Nothing has been added to this order yet.",
      totalFrom: "total_cost_cents",
      columns: [
        { label: "Item", value: (row) => text(row.item_name, "Unnamed") },
        { label: "Ordered", value: (row) => quantity(row.quantity_ordered, row.unit) },
        { label: "Received", value: (row) => quantity(row.quantity_received, row.unit) },
        { label: "Each", value: (row) => money(row.unit_cost_cents) },
        { label: "Line total", value: (row) => money(row.total_cost_cents) }
      ],
      form: {
        legend: "Add a line",
        fields: [
          { name: "item_name", label: "Item", required: true, maxLength: 200 },
          { name: "quantity_ordered", label: "Quantity ordered", type: "number" },
          { name: "quantity_received", label: "Quantity received so far", type: "number" },
          { name: "unit", label: "Unit", maxLength: 40 },
          { name: "unit_cost_cents", label: "Cost each, in pence or cents", type: "number", hint: "1250 means £12.50 or $12.50." },
          { name: "total_cost_cents", label: "Line total, in pence or cents", type: "number" }
        ]
      }
    },
    form: {
      legend: "Raise a purchase order",
      fields: [
        { name: "po_number", label: "Order number", maxLength: 80 },
        { name: "vendor_id", label: "Supplier", type: "reference", from: "vendors" },
        { name: "location_id", label: "Deliver to", type: "reference", from: "locations" },
        { name: "expected_at", label: "Expected date", type: "date" },
        { name: "total_cents", label: "Total in pence or cents", type: "number", hint: "1250 means £12.50 or $12.50." },
        { name: "notes", label: "Notes", type: "textarea", maxLength: 2000 },
        { name: "status", label: "Status", type: "select", options: ["draft", "sent", "partially_received", "received", "cancelled", "archived"] }
      ]
    }
  },
  {
    path: "/business-builder/owner/stock-counts",
    select: "count_date,created_at,id,notes,status",
    api: "/api/business/stock-counts",
    table: "inventory_count_sessions",
    title: "Stock counts",
    body: "Each time somebody counted what is actually on the shelves, and whether that count has been approved.",
    empty: "No stock count has been recorded yet. Start one below.",
    columns: [
      { label: "Counted on", value: (row) => day(row.count_date) },
      { label: "Status", value: (row) => words(row.status) },
      { label: "Notes", value: (row) => text(row.notes, "None") },
      { label: "Started", value: (row) => when(row.created_at) }
    ],
    lines: {
      table: "inventory_count_lines",
      parentColumn: "count_session_id",
      api: "/api/business/stock-count-lines",
      title: "What was counted",
      empty: "Nothing has been counted in this session yet.",
      totalFrom: "extended_value_cents",
      columns: [
        { label: "Item", value: (row) => text(row.item_name, "Unnamed") },
        { label: "Counted", value: (row) => quantity(row.counted_quantity, row.unit) },
        { label: "Each", value: (row) => money(row.unit_cost_cents) },
        { label: "Value", value: (row) => money(row.extended_value_cents) }
      ],
      form: {
        legend: "Add a counted item",
        fields: [
          { name: "item_name", label: "Item", required: true, maxLength: 200 },
          { name: "counted_quantity", label: "How many you counted", type: "number" },
          { name: "unit", label: "Unit", maxLength: 40 },
          { name: "unit_cost_cents", label: "Cost each, in pence or cents", type: "number" },
          { name: "extended_value_cents", label: "Value of this line, in pence or cents", type: "number" }
        ]
      }
    },
    form: {
      legend: "Start a stock count",
      fields: [
        { name: "count_date", label: "Date counted", type: "date" },
        { name: "location_id", label: "Where", type: "reference", from: "locations" },
        { name: "notes", label: "Notes", type: "textarea", maxLength: 2000 },
        { name: "status", label: "Status", type: "select", options: ["draft", "submitted", "approved", "archived"] }
      ]
    }
  },
  {
    path: "/business-builder/owner/transfers",
    select: "created_at,id,notes,status",
    api: "/api/business/transfers",
    table: "location_transfers",
    title: "Transfers between locations",
    body: "Stock moved from one of your locations to another, and whether it has arrived.",
    empty: "You have not recorded a transfer yet. Add your first one below.",
    columns: [
      { label: "Status", value: (row) => words(row.status) },
      { label: "Notes", value: (row) => text(row.notes, "None") },
      { label: "Recorded", value: (row) => when(row.created_at) }
    ],
    lines: {
      table: "location_transfer_lines",
      parentColumn: "transfer_id",
      api: "/api/business/transfer-lines",
      title: "What was moved",
      empty: "Nothing has been added to this transfer yet.",
      totalFrom: "estimated_cost_cents",
      columns: [
        { label: "Item", value: (row) => text(row.item_name, "Unnamed") },
        { label: "Quantity", value: (row) => quantity(row.quantity, row.unit) },
        { label: "Estimated value", value: (row) => money(row.estimated_cost_cents) }
      ],
      form: {
        legend: "Add an item to this transfer",
        fields: [
          { name: "item_name", label: "Item", required: true, maxLength: 200 },
          { name: "quantity", label: "Quantity", type: "number" },
          { name: "unit", label: "Unit", maxLength: 40 },
          { name: "estimated_cost_cents", label: "Estimated value, in pence or cents", type: "number" }
        ]
      }
    },
    form: {
      legend: "Record a transfer",
      fields: [
        { name: "from_location_id", label: "From", type: "reference", from: "locations" },
        { name: "to_location_id", label: "To", type: "reference", from: "locations" },
        { name: "notes", label: "Notes", type: "textarea", maxLength: 2000 },
        { name: "status", label: "Status", type: "select", options: ["draft", "sent", "received", "cancelled", "archived"] }
      ]
    }
  },
  // Selling something that is not a service.
  //
  // Everything above this point prices work: a service has one price and a
  // duration, a menu item is a dish, an inventory item is stock on hand. None
  // of them is a thing sold in sizes, colours or pack sizes at different
  // prices, and until this page a business that sold objects had to write each
  // one out by hand on every invoice.
  //
  // The variants are the child rather than a second page, for the same reason
  // purchase order lines are: a variant detached from its product is an
  // orphaned row, and "Large" on its own names nothing.
  //
  // **The price is on the variant and nowhere else.** A product with two sizes
  // at one price is a product with two variants that happen to agree. A price
  // on the parent as well would give two answers to "what does this cost", and
  // this codebase keeps finding exactly that shape.
  {
    path: "/business-builder/owner/products",
    select: "category,created_at,id,name,status",
    api: "/api/business/merchant-products",
    table: "merchant_products",
    title: "Products you sell",
    body: "Things rather than time — what you sell, in which variations, and at what price.",
    empty: "You have not listed a product yet. Add your first one below.",
    columns: [
      { label: "Product", value: (row) => text(row.name, "Unnamed") },
      { label: "Group", value: (row) => text(row.category, "Not grouped") },
      { label: "Status", value: (row) => words(row.status) },
      { label: "Listed", value: (row) => when(row.created_at) }
    ],
    lines: {
      table: "merchant_product_variants",
      parentColumn: "product_id",
      api: "/api/business/product-variants",
      title: "The versions of this product you sell",
      empty: "This product has no versions yet, so there is no price to put on an invoice.",
      // Deliberately absent. `totalFrom` sums a column and prints it under the
      // table, which is right for lines of an order and wrong here: adding up
      // the prices of a small, a medium and a large produces a number nobody
      // is ever charged.
      columns: [
        { label: "Version", value: (row) => text(row.variant_name, "Unnamed") },
        { label: "Code", value: (row) => text(row.sku, "None") },
        { label: "Price", value: (row) => money(row.price_cents, row.currency) },
        { label: "Status", value: (row) => words(row.status) }
      ],
      form: {
        legend: "Add a version",
        fields: [
          { name: "variant_name", label: "What makes this one different", required: true, maxLength: 200, hint: "Large, Blue, Box of 12 — or “Standard” if there is only one." },
          { name: "sku", label: "Product code", maxLength: 120 },
          { name: "price_cents", label: "Price, in pence or cents", type: "number", hint: "1250 means £12.50 or $12.50." },
          { name: "currency", label: "Currency", maxLength: 20 },
          // Optional, and it links rather than deducts. Nothing in this
          // application decrements stock when something sells, so the label
          // says what the link is for instead of implying a count that moves.
          { name: "inventory_item_id", label: "Stock item this comes out of, if you track it", type: "reference", from: "inventory" },
          { name: "status", label: "Status", type: "select", options: ACTIVE_STATUSES }
        ]
      }
    },
    // Whether this product can actually be sold, which is a fact about its
    // children and so cannot be a column on the list above.
    derivedCard: (product, childRows, ui) => {
      const listed = childRows[0];
      if (!listed || listed.ok !== true) {
        return ui.card("Ready to sell", "We could not read the versions of this product just now, so we cannot say whether it has a price.");
      }
      const rows = listed.rows;
      if (!rows.length) {
        return ui.card("Ready to sell", "Not yet. A product is priced through its versions, so add at least one below — call it “Standard” if there is only one.");
      }
      const sellable = rows.filter((row) => String(row.status || "") === "active");
      if (!sellable.length) {
        return ui.card("Ready to sell", `Not yet. All ${rows.length} versions of this product are inactive or archived, so there is nothing a customer could be charged for.`);
      }
      const prices = sellable.map((row) => finiteNumber(row.price_cents));
      const unpriced = prices.filter((price) => price === null).length;
      const known = prices.filter((price) => price !== null);
      // A blank price is not a free product. Every other total in this file
      // learned the same thing the hard way.
      const missing = unpriced ? ` ${unpriced} of them has no price recorded, so it is not counted here.` : "";
      if (!known.length) {
        return ui.card("Ready to sell", `${sellable.length} version${sellable.length === 1 ? "" : "s"} on sale, and none of them has a price recorded.`);
      }
      const low = Math.min(...known);
      const high = Math.max(...known);
      const range = low === high ? money(low) : `${money(low)} to ${money(high)}`;
      return ui.card("Ready to sell", `Yes — ${sellable.length} version${sellable.length === 1 ? "" : "s"} on sale at ${range}.${missing} Put one on a quote or an invoice to charge for it.`);
    },
    form: {
      legend: "List a product",
      fields: [
        { name: "name", label: "What it is", required: true, maxLength: 200 },
        { name: "category", label: "Group it belongs to", maxLength: 120, hint: "Your own word for it — nothing here depends on the wording." },
        { name: "description", label: "Description", type: "textarea", maxLength: 2000 },
        { name: "location_id", label: "Sold from", type: "reference", from: "locations" },
        { name: "status", label: "Status", type: "select", options: ["draft", "active", "inactive", "archived"] }
      ]
    }
  },
  // Accounts receivable.
  //
  // Every money table in this product pointed outward before these two: what
  // the business owes its suppliers, and what it pays SONARA. A business could
  // record a bill it had to pay and had nowhere to record a bill it had sent.
  // docs/market/2026-08-11-TRADES-AI-TOOL-STACK.md has the analysis; for a
  // trades business the receivable side is the business.
  //
  // Customers come first because an invoice needs somebody to be addressed to,
  // and `customers` had a table, row level security and no way in -- bookings
  // store a customer's name as free text rather than pointing at it.
  {
    path: "/business-builder/owner/customers",
    // Two things you can do with one customer record, and neither had a link.
    //
    // /business-builder/owner/customers/:recordId/contact has existed and
    // rendered a vCard since the contact-card work, reachable only by typing
    // the URL. The call page is new. Both are the same defect this codebase
    // keeps finding when they are not listed here: a working route nothing
    // points at.
    download: [
      { label: "Save this contact", href: (recordId) => `/business-builder/owner/customers/${recordId}/contact` },
      { label: "Call this customer", href: (recordId) => `/business-builder/owner/customers/${recordId}/call` }
    ],
    select: "email,id,name,phone,source,status",
    api: "/api/business/customers",
    table: "customers",
    title: "Customers",
    body: "The people and businesses you work for, so an invoice has somebody to go to.",
    empty: "You have not recorded a customer yet. Add your first one below.",
    columns: [
      { label: "Name", value: (row) => text(row.name, "Unnamed") },
      { label: "Email", value: (row) => text(row.email, "None") },
      { label: "Phone", value: (row) => text(row.phone, "None") },
      { label: "How they found you", value: (row) => text(row.source, "Not recorded") },
      { label: "Status", value: (row) => words(row.status) }
    ],
    form: {
      legend: "Add a customer",
      fields: [
        { name: "name", label: "Name", required: true, maxLength: 200 },
        { name: "email", label: "Email", type: "email", maxLength: 200 },
        { name: "phone", label: "Phone", maxLength: 40 },
        { name: "source", label: "How they found you", maxLength: 120, hint: "Referral, Google, repeat customer" },
        { name: "status", label: "Status", type: "select", options: ["active", "inactive", "archived"] }
      ]
    }
  },
  {
    path: "/business-builder/owner/quotes",
    select: "amount_cents,created_at,customer_id,id,status,title",
    api: "/api/business/quotes",
    table: "quotes",
    shareableAs: "quote",
    shareNoun: "quote",
    shareShows: "It shows the title, the amount and the status. It never shows who the quote is for, or anything else in your business.",
    title: "Quotes",
    body: "What you have quoted for, and what it came to. A quote you have won becomes an invoice from here.",
    empty: "You have not written a quote yet. Add your first one below.",
    columns: [
      { label: "Quote", value: (row) => text(row.title, "Untitled") },
      { label: "Amount", value: (row) => money(row.amount_cents) },
      { label: "Status", value: (row) => words(row.status) },
      { label: "Written", value: (row) => day(row.created_at) }
    ],
    // The action this page exists to make possible. Without it the conversion
    // endpoint was reachable only by an API client, which is not what a trades
    // owner has.
    rowAction: {
      api: "/api/business/quotes/:id/invoice",
      label: "Turn into an invoice",
      columnLabel: "Invoice",
      reasonUnavailable: (row) => {
        const status = String(row?.status || "").toLowerCase();
        if (status !== "accepted") return status === "sent" ? "Waiting on their answer" : `Not accepted (${status || "no status"})`;
        if (!row?.customer_id) return "No customer on this quote";
        if (!Number(row?.amount_cents)) return "No amount on this quote";
        return null;
      }
    },
    form: {
      legend: "Write a quote",
      fields: [
        { name: "title", label: "What it is for", required: true, maxLength: 200 },
        { name: "customer_id", label: "Customer", type: "reference", from: "customers" },
        { name: "amount_cents", label: "Amount, in pence or cents", type: "number", hint: "1250 means £12.50 or $12.50." },
        { name: "status", label: "Status", type: "select", options: ["draft", "sent", "accepted", "declined", "expired"] }
      ]
    }
  },
  {
    path: "/business-builder/owner/receivables",
    select: "currency,due_on,id,invoice_number,issued_on,status,total_cents",
    api: "/api/business/receivables",
    table: "customer_invoices",
    shareableAs: "customer_invoice",
    shareNoun: "invoice",
    shareShows: "It shows the invoice number, the dates, what is on it and the totals. It never shows your notes, the customer's details, or anything else in your business.",
    // The same invoice as a file, offered from the page the business already
    // opens to look at it. The route was written before this link was, and a
    // download nothing links to is one nobody finds -- which is the whole of
    // why this field exists rather than the route standing on its own.
    download: { label: "Download this invoice", href: (recordId) => `/business-builder/owner/invoices/${recordId}/pdf` },
    title: "Money owed to you",
    body: "Invoices you have sent, what they came to, and what has been paid against them.",
    empty: "You have not raised an invoice yet. Add your first one below.",
    columns: [
      { label: "Invoice", value: (row) => text(row.invoice_number, "No number") },
      { label: "Issued", value: (row) => day(row.issued_on) },
      { label: "Due", value: (row) => day(row.due_on) },
      { label: "Total", value: (row) => money(row.total_cents, row.currency) },
      { label: "Status", value: (row) => words(row.status) }
    ],
    // Two children: what is on the invoice, and what has come in against it.
    // Line items are listed first because an invoice is written before it is
    // paid, and a page that opens with payments reads as a receipt.
    lines: [{
      table: "customer_invoice_lines",
      parentColumn: "invoice_id",
      api: "/api/business/invoice-lines",
      title: "What is on this invoice",
      empty: "Nothing has been added to this invoice yet.",
      totalFrom: "line_total_cents",
      columns: [
        { label: "Description", value: (row) => text(row.description, "Not described") },
        { label: "Quantity", value: (row) => quantity(row.quantity) },
        { label: "Each", value: (row) => money(row.unit_price_cents) },
        { label: "Line total", value: (row) => money(row.line_total_cents) }
      ],
    // Either pick something from the catalogue, or type the line out.
    //
    // Both `description` and `line_total_cents` used to be required outright,
    // which made picking a version pointless: the line recorded which one it
    // came from and the person still typed the name and the price they had just
    // set on it. The catalogue's whole promise is not retyping.
    //
    // So the two fields come off `required` -- otherwise the browser blocks the
    // submission before the server can fill anything -- and the rule moves here,
    // where it can be "one or the other" rather than "always".
    requireEither: { reference: "variant_id", fields: ["description", "line_total_cents"] },
    // What a chosen version fills in, and only where the person left a blank.
    //
    // Never an overwrite. A line total is what the business decided to charge,
    // and a typed price is a discount somebody meant -- filling over it would be
    // the stored number disagreeing with the decision behind it.
    fillFrom: {
      field: "variant_id",
      table: "merchant_product_variants",
      select: "id,variant_name,price_cents,merchant_products(name)",
      fills: ["description", "unit_price_cents", "line_total_cents"],
      values: (variant, submitted) => {
        const product = String(variant?.merchant_products?.name || "").trim();
        const version = String(variant?.variant_name || "").trim();
        const price = finiteNumber(variant?.price_cents);
        // A blank quantity is the column's own `not null default 1`, not a
        // guess -- so a version picked with nothing else typed still totals to
        // its price rather than to zero. A quantity that was typed and cannot
        // be read stays null, and no total is computed from it.
        const quantity = submitted.quantity === undefined ? 1 : finiteNumber(submitted.quantity);
        return {
          description: [product, version].filter(Boolean).join(" \u2014 ") || null,
          unit_price_cents: price,
          line_total_cents: price !== null && quantity !== null ? Math.round(price * quantity) : null
        };
      }
    },
      form: {
        legend: "Add a line",
        fields: [
          { name: "description", label: "Description", maxLength: 300, hint: "Leave blank if you pick a product below." },
          { name: "service_id", label: "From your services", type: "reference", from: "services" },
          // The catalogue side of the same question. Both are optional and a
          // line can still be free text, which is how most of them are
          // written; neither fills in the description, the quantity or the
          // price, because a line is what the business decided to charge and
          // copying the list price over it would overwrite a discount.
          { name: "variant_id", label: "From your products", type: "reference", from: "productVariants" },
          { name: "quantity", label: "Quantity", type: "number" },
          { name: "unit_price_cents", label: "Price each, in pence or cents", type: "number", hint: "1250 means £12.50 or $12.50." },
          { name: "line_total_cents", label: "Line total, in pence or cents", type: "number", hint: "Leave blank to use the catalogue price. Type one to charge something else." }
        ]
      }
    }, {
      table: "customer_invoice_payments",
      parentColumn: "invoice_id",
      api: "/api/business/invoice-payments",
      title: "What has been paid against this invoice",
      empty: "Nothing has been received against this invoice yet.",
      totalFrom: "amount_cents",
      columns: [
        { label: "Received", value: (row) => day(row.received_on) },
        { label: "Amount", value: (row) => money(row.amount_cents) },
        { label: "How", value: (row) => text(row.method, "Not recorded") },
        { label: "Reference", value: (row) => text(row.reference, "None") }
      ],
      form: {
        legend: "Record a payment received",
        fields: [
          { name: "amount_cents", label: "Amount, in pence or cents", type: "number", required: true, hint: "1250 means £12.50 or $12.50." },
          { name: "received_on", label: "Date received", type: "date" },
          { name: "method", label: "How it came in", maxLength: 60, hint: "Bank transfer, card, cash, cheque" },
          { name: "reference", label: "Reference", maxLength: 120 }
        ]
      }
    }],
    form: {
      legend: "Raise an invoice",
      fields: [
        { name: "customer_id", label: "Customer", required: true, type: "reference", from: "customers" },
        { name: "invoice_number", label: "Invoice number", maxLength: 120 },
        { name: "issued_on", label: "Date issued", type: "date" },
        { name: "due_on", label: "Date due", type: "date" },
        { name: "subtotal_cents", label: "Subtotal, in pence or cents", type: "number" },
        { name: "tax_cents", label: "Tax, in pence or cents", type: "number" },
        { name: "total_cents", label: "Total, in pence or cents", type: "number", hint: "1250 means £12.50 or $12.50." },
        { name: "status", label: "Status", type: "select", options: ["draft", "sent", "paid", "void", "written_off"] },
        { name: "notes", label: "Notes", maxLength: 500 }
      ]
    }
  }
]);

function pageForPath(path) {
  return ALL_OWNER_PAGES.find((page) => page.path === path);
}

function pageForApi(api) {
  return [...ALL_OWNER_PAGES, ...CREATOR_RECORD_PAGES].find((page) => page.api && page.api === api);
}

// The operations pages behave exactly like the original fourteen, so everything
// that walks the owner pages walks all of them. Kept as a separate array above
// only so the reason those three exist stays next to them.
const ALL_OWNER_PAGES = Object.freeze([...OWNER_RECORD_PAGES, ...OPERATIONS_RECORD_PAGES]);

// A record's child tables, as a list.
//
// `lines` was a single object, which was right while every record with
// children had exactly one kind. An invoice has two: what is on it, and what
// has been paid against it. Neither is optional and neither belongs on a page
// of its own -- a line detached from its invoice is an orphaned row, which is
// why lib/sonara-orphan-tables.cjs classifies these tables build-with-parent.
//
// Accepting either shape keeps the four existing declarations unchanged rather
// than rewriting them to be arrays of one.
// A record's own actions, as a list.
//
// `download` was a single object, which was right while exactly one page had
// one. A customer has two -- save their details, or call them -- and accepting
// either shape keeps the invoice declaration unchanged rather than rewriting it
// as an array of one. Same reasoning as childrenOf below, and deliberately the
// same shape so there is one idiom here rather than two.
function downloadsOf(page) {
  if (!page || !page.download) return [];
  return Array.isArray(page.download) ? page.download : [page.download];
}

function childrenOf(page) {
  if (!page || !page.lines) return [];
  return Array.isArray(page.lines) ? page.lines : [page.lines];
}

module.exports = {
  ALL_OWNER_PAGES,
  downloadsOf,
  // Re-exported: it lives in sonara-numbers.cjs now, and enough modules
  // import it from here that moving the import sites would be churn.
  finiteNumber,
  childrenOf,
  OPERATIONS_RECORD_PAGES,
  OWNER_RECORD_PAGES,
  CREATOR_RECORD_PAGES,
  REFERENCE_SOURCES,
  day,
  hours,
  money,
  pageForApi,
  pageForPath,
  percent,
  quantity,
  text,
  when,
  words
};
