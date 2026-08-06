"use strict";

// What the business assistant looks for.
//
// The nineteen agent tables have never had anything running against them, and
// lib/sonara-agent-authority.cjs now says what an agent would be allowed to do.
// This is the other half: the work itself, for the actions on the self-serve
// list -- check_data_quality, prepare_report, suggest_next_step. Those three
// are on that list because they read records the business already owns and
// change nothing, which is also why they can run without a model behind them.
//
// Every check here is arithmetic and comparison over the owner's own rows. No
// model call, no provider, no metered API, nothing that costs the customer
// anything per run. That is not a limitation worked around; it is the reason
// these can run at all under the requirement that everything be free.
//
// The columns are the part that would silently rot. Seventeen owner forms
// shipped once sending `user_id` to tables that do not have it -- every save
// failed in production while the tests passed against a stub. So no column here
// is typed from memory: validate() checks every one against
// supabase/migrations/ via lib/sonara-migration-columns.cjs, and
// tests/business-checks.test.js fails if a single name is wrong. A check that
// names a column PostgREST does not have returns PGRST204 and reads to the
// owner as "nothing to fix".

const { describedColumns } = require("./sonara-migration-columns.cjs");

function columnNames(table) {
  const described = describedColumns(table);
  return Array.isArray(described) ? described.map((column) => column.name) : [];
}

function money(cents) {
  const value = Number(cents);
  if (!Number.isFinite(value)) return "an unknown amount";
  return `$${(value / 100).toFixed(2)}`;
}

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === "";
}

function isMissingNumber(value) {
  return value === null || value === undefined || Number(value) === 0;
}

// Each check declares the table it reads, the columns it needs, which rows
// count as findings, and what the owner should do. `severity` orders the list:
// "money" first because those cost something every day they stand, then
// "blocked" for work that cannot proceed, then "tidy".
//
// The sentences are written to a business owner, not to an operator. "3 services
// have no price" is a fact; "You cannot take a payment for a service with no
// price" is why they should care.
const CHECKS = Object.freeze([
  Object.freeze({
    id: "menu_items_priced_below_cost",
    severity: "money",
    table: "menu_items",
    columns: ["id", "name", "selling_price_cents", "theoretical_cost_cents", "status"],
    label: "Dishes that lose money",
    // Both sides have to be real numbers. A dish with no recorded cost is not
    // losing money, it is unmeasured, and the check below catches that instead.
    finds: (row) =>
      Number(row.selling_price_cents) > 0 &&
      Number(row.theoretical_cost_cents) > 0 &&
      Number(row.theoretical_cost_cents) >= Number(row.selling_price_cents),
    describe: (row) =>
      `${row.name || "A dish"} sells for ${money(row.selling_price_cents)} and costs ${money(row.theoretical_cost_cents)} to make.`,
    why: "Every one of these sold loses money. This is the check worth running first, because nothing on the receipt looks wrong.",
    fixPath: "/business-builder/owner/menu",
    fixLabel: "Open the menu"
  }),
  Object.freeze({
    id: "menu_items_without_cost",
    severity: "money",
    table: "menu_items",
    columns: ["id", "name", "selling_price_cents", "theoretical_cost_cents"],
    label: "Dishes with no recorded cost",
    finds: (row) => Number(row.selling_price_cents) > 0 && isMissingNumber(row.theoretical_cost_cents),
    describe: (row) => `${row.name || "A dish"} has a price but no cost, so its margin is unknown.`,
    why: "Without a cost there is no way to tell whether this makes money.",
    fixPath: "/business-builder/owner/menu",
    fixLabel: "Open the menu"
  }),
  Object.freeze({
    id: "invoices_overdue_unpaid",
    severity: "money",
    table: "vendor_invoices",
    columns: ["id", "invoice_number", "due_date", "total_cents", "payment_status"],
    label: "Supplier invoices past due",
    finds: (row) => {
      if (isBlank(row.due_date)) return false;
      const paid = String(row.payment_status || "").toLowerCase();
      if (paid === "paid" || paid === "settled" || paid === "void" || paid === "cancelled") return false;
      const due = Date.parse(row.due_date);
      return Number.isFinite(due) && due < Date.now();
    },
    describe: (row) => `Invoice ${row.invoice_number || "(no number)"} for ${money(row.total_cents)} was due ${row.due_date}.`,
    why: "Late payments cost relationships before they cost fees.",
    fixPath: "/business-builder/owner/invoices",
    fixLabel: "Open invoices"
  }),
  Object.freeze({
    id: "services_without_price",
    severity: "blocked",
    table: "business_service_catalog",
    columns: ["id", "name", "price_cents", "status"],
    label: "Services with no price",
    finds: (row) => String(row.status || "").toLowerCase() !== "archived" && isMissingNumber(row.price_cents),
    describe: (row) => `${row.name || "A service"} has no price set.`,
    why: "A service with no price cannot be paid for, so it cannot be booked and paid in one go.",
    fixPath: "/business-builder/owner/services",
    fixLabel: "Open services"
  }),
  Object.freeze({
    id: "bookings_without_contact",
    severity: "blocked",
    table: "business_bookings",
    columns: ["id", "customer_name", "customer_email", "customer_phone", "starts_at", "status"],
    label: "Bookings with no way to reach the customer",
    finds: (row) => {
      const status = String(row.status || "").toLowerCase();
      if (status === "cancelled" || status === "completed" || status === "no_show") return false;
      return isBlank(row.customer_email) && isBlank(row.customer_phone);
    },
    describe: (row) => `${row.customer_name || "A booking"} on ${row.starts_at || "an unrecorded date"} has no email or phone.`,
    why: "If anything changes, there is no way to tell them.",
    fixPath: "/business-builder/owner/bookings",
    fixLabel: "Open bookings"
  }),
  Object.freeze({
    id: "inventory_at_or_below_reorder",
    severity: "blocked",
    table: "inventory_items",
    columns: ["id", "name", "quantity", "reorder_level", "unit", "status"],
    label: "Stock at or below its reorder level",
    finds: (row) =>
      String(row.status || "").toLowerCase() !== "archived" &&
      Number(row.reorder_level) > 0 &&
      Number(row.quantity) <= Number(row.reorder_level),
    describe: (row) => `${row.name || "An item"} is down to ${row.quantity ?? 0} ${row.unit || "units"}, at or below its reorder level of ${row.reorder_level}.`,
    why: "You set the reorder level so somebody would notice before it ran out.",
    fixPath: "/business-builder/owner/inventory",
    fixLabel: "Open inventory"
  }),
  Object.freeze({
    id: "vehicle_registration_expiring",
    severity: "blocked",
    table: "vehicle_records",
    columns: ["id", "make", "model", "plate_number", "registration_expires_at", "status"],
    label: "Vehicle registration expired or expiring",
    finds: (row) => {
      if (String(row.status || "").toLowerCase() === "retired") return false;
      if (isBlank(row.registration_expires_at)) return false;
      const expires = Date.parse(row.registration_expires_at);
      // Thirty days, because renewing takes longer than noticing.
      return Number.isFinite(expires) && expires < Date.now() + 30 * 24 * 60 * 60 * 1000;
    },
    describe: (row) =>
      `${[row.make, row.model].filter(Boolean).join(" ") || "A vehicle"}${row.plate_number ? ` (${row.plate_number})` : ""} expires ${row.registration_expires_at}.`,
    why: "An unregistered vehicle on the road is a bigger problem than a renewal fee.",
    fixPath: "/business-builder/owner/vehicles",
    fixLabel: "Open vehicles"
  }),
  Object.freeze({
    id: "staff_without_contact",
    severity: "tidy",
    table: "business_employee_profiles",
    columns: ["id", "display_name", "email", "phone", "status"],
    label: "Staff with no contact details",
    finds: (row) => {
      const status = String(row.status || "").toLowerCase();
      if (status === "terminated" || status === "archived" || status === "inactive") return false;
      return isBlank(row.email) && isBlank(row.phone);
    },
    describe: (row) => `${row.display_name || "A staff member"} has no email or phone on file.`,
    why: "Schedules and shift changes have nowhere to go.",
    fixPath: "/business-builder/owner/staff",
    fixLabel: "Open staff"
  }),
  Object.freeze({
    id: "locations_without_address",
    severity: "tidy",
    table: "business_locations",
    columns: ["id", "name", "address_line1", "city", "status"],
    label: "Locations with no address",
    finds: (row) => String(row.status || "").toLowerCase() !== "closed" && isBlank(row.address_line1),
    describe: (row) => `${row.name || "A location"} has no street address.`,
    why: "Customers, deliveries and tax records all need one.",
    fixPath: "/business-builder/owner/locations",
    fixLabel: "Open locations"
  })
]);

const SEVERITY_ORDER = Object.freeze(["money", "blocked", "tidy"]);

const SEVERITY_LABEL = Object.freeze({
  money: "Costing you money",
  blocked: "Stopping work",
  tidy: "Worth tidying"
});

// Every column every check names, checked against the migrations. Returns the
// problems rather than throwing, so a test can print all of them at once
// instead of one per run.
function validate() {
  const problems = [];
  for (const check of CHECKS) {
    const available = columnNames(check.table);
    if (available.length === 0) {
      problems.push(`${check.id}: no table named ${check.table} in supabase/migrations`);
      continue;
    }
    for (const column of check.columns) {
      if (!available.includes(column)) {
        problems.push(`${check.id}: ${check.table} has no column ${column}`);
      }
    }
    if (!available.includes("organization_id")) {
      // Without this there is no tenant filter, and a check would read every
      // business's rows. Better to refuse the check than to scope it by hand.
      problems.push(`${check.id}: ${check.table} has no organization_id, so this check cannot be scoped to one business`);
    }
  }
  return problems;
}

// PostgREST select list. organization_id is not requested -- the filter carries
// it, and returning it would only invite something downstream to trust it.
function selectFor(check) {
  return [...new Set(check.columns)].join(",");
}

// Run one check over rows already fetched. Pure, so the tests exercise the
// judgement without a database.
function runCheck(check, rows) {
  const findings = (Array.isArray(rows) ? rows : [])
    .filter((row) => {
      try {
        return check.finds(row);
      } catch {
        // A malformed row is not a finding. Throwing here would fail the whole
        // page over one bad record.
        return false;
      }
    })
    .map((row) => ({ id: row.id, sentence: check.describe(row) }));
  return {
    id: check.id,
    label: check.label,
    severity: check.severity,
    why: check.why,
    fixPath: check.fixPath,
    fixLabel: check.fixLabel,
    count: findings.length,
    findings
  };
}

// Ordered results, worst first, with the empty ones kept. An owner needs to see
// that a check ran and found nothing -- dropping it makes "we did not look"
// and "there is nothing wrong" render identically.
function summarise(results) {
  const ordered = [...results].sort((a, b) => {
    const bySeverity = SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
    if (bySeverity !== 0) return bySeverity;
    return b.count - a.count;
  });
  const total = ordered.reduce((sum, result) => sum + result.count, 0);
  return { results: ordered, total, clean: ordered.filter((result) => result.count === 0).length };
}

module.exports = {
  CHECKS,
  SEVERITY_ORDER,
  SEVERITY_LABEL,
  validate,
  selectFor,
  runCheck,
  summarise,
  money
};
