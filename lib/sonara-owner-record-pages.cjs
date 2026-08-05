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
    lines: {
      table: "vendor_invoice_lines",
      parentColumn: "invoice_id",
      api: "/api/business/invoice-lines",
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

// Creator Studio's two record pages. They live beside the Business Builder ones
// because they are rendered by the same code and follow the same rules; the
// route file gives them their own heading and links.
//
// Both shipped as three cards describing what they would show, the same way the
// owner pages did, while the tables behind them already existed.
const CREATOR_RECORD_PAGES = Object.freeze([
  {
    path: "/creator-studio/music-projects",
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
    api: "/api/sensory/sound-cues",
    table: "sound_cues",
    title: "Sound and motion cues",
    // AGENTS.md: sounds, haptics and motion are off or explicitly user-controlled
    // by default. The page says so rather than leaving somebody to assume it,
    // and nothing here plays anything.
    body: "Cues you have defined for your own projects. Nothing plays, vibrates or moves on its own — a cue only runs when something you do asks for it and your device allows it.",
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
        title: "Vibration patterns",
        empty: "You have not defined any vibration patterns yet.",
        columns: [
          { label: "Pattern", value: (row) => text(row.name, "Unnamed") },
          { label: "Fires on", value: (row) => words(row.event_name) },
          { label: "Notes", value: (row) => text(row.accessibility_notes, "None") },
          { label: "Status", value: (row) => words(row.status) }
        ]
      }
    ]
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
    path: "/business-builder/owner/purchase-orders",
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

module.exports = {
  ALL_OWNER_PAGES,
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
