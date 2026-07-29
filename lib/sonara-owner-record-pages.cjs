"use strict";

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

function money(cents, currency = "usd") {
  const amount = Number(cents);
  if (!Number.isFinite(amount)) return "Not set";
  const symbol = String(currency || "usd").toLowerCase() === "usd" ? "$" : "";
  return `${symbol}${(amount / 100).toFixed(2)}`;
}

function quantity(value, unit) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "Not counted";
  const unitText = String(unit || "").trim();
  return unitText ? `${amount} ${unitText}` : String(amount);
}

function percent(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? `${(amount * 100).toFixed(1)}%` : "Not set";
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
    api: "/api/business/bookings",
    table: "business_bookings",
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
    }
  },
  {
    path: "/business-builder/owner/schedules",
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
    }
  },
  {
    path: "/business-builder/owner/menu",
    api: "/api/business/menu-items",
    table: "menu_items",
    title: "Menu",
    body: "What you charge against what it costs you to make, so you can see the margin on each item.",
    empty: "Nothing on the menu yet.",
    columns: [
      { label: "Item", value: (row) => text(row.name, "Unnamed") },
      { label: "You charge", value: (row) => money(row.selling_price_cents, row.currency) },
      { label: "It costs", value: (row) => money(row.theoretical_cost_cents, row.currency) },
      {
        label: "You keep",
        value: (row) => {
          const price = Number(row.selling_price_cents);
          const cost = Number(row.theoretical_cost_cents);
          if (!Number.isFinite(price) || !Number.isFinite(cost) || price <= 0) return "Not set";
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
    path: "/business-builder/owner/costs",
    api: null,
    table: "daily_profit_snapshots",
    title: "Food Costs",
    body: "A day at a time: what you took, what it cost you and what was left. These are worked out from your own records rather than entered by hand.",
    empty: "No daily figures yet. They appear once you have sales and costs recorded.",
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
  }
]);

// A form field can point at another of these pages ("reference"), and the
// dropdown is filled from that page's own records.
const REFERENCE_SOURCES = Object.freeze({
  staff: { table: "business_employee_profiles", label: (row) => row.display_name || row.employee_number || row.id },
  vendors: { table: "vendor_accounts", label: (row) => row.name || row.account_number || row.id },
  recipes: { table: "recipe_cards", label: (row) => row.name || row.id },
  locations: { table: "business_locations", label: (row) => row.name || row.id }
});

function pageForPath(path) {
  return OWNER_RECORD_PAGES.find((page) => page.path === path);
}

function pageForApi(api) {
  return OWNER_RECORD_PAGES.find((page) => page.api && page.api === api);
}

module.exports = {
  OWNER_RECORD_PAGES,
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
