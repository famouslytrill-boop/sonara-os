"use strict";

// Finding one record among thousands.
//
// This product had no search of any kind. No /search route, no tsvector, no
// index, nothing. An owner with two years of bookings could open
// /business-builder/owner/bookings, see the most recent hundred, and have no
// way at all to find the one from March -- and every record page in the product
// had the same hole. It was not a missing feature so much as an unnoticed one:
// each page works, so nothing looked broken.
//
// What this is, precisely: case-insensitive substring matching across a named
// set of columns per table, scoped to one organization, run through PostgREST's
// `or` filter. It is not ranked full-text search and does not pretend to be.
//
// Why not Postgres full-text, which is free and built in: a tsvector column and
// a GIN index per table is a schema change across nineteen tables, and the value
// of ranking arrives at a scale a single business does not reach. A restaurant
// has hundreds of menu items, not millions. Substring matching answers "find the
// booking for Smith" correctly at that size, needs no migration, and can be
// replaced by full-text later without changing this module's shape. The reason
// is recorded because "we used ilike" looks like laziness without it.
//
// Two boundaries the searchable set is drawn around.
//
// Only columns a person would search by -- names, titles, numbers, notes.
// Searching every text column would return matches on internal status strings
// and metadata, which is noise that makes a result list untrustworthy.
//
// Nothing secret-shaped, ever. No column whose name suggests a key, a token or
// a credential is searchable, and validate() refuses one rather than trusting
// the list below to have been written carefully.

const { describedColumns } = require("./sonara-migration-columns.cjs");

function columnNames(table) {
  const described = describedColumns(table);
  return Array.isArray(described) ? described.map((column) => column.name) : [];
}

// A column matching any of these is refused even if somebody lists it.
const SECRET_SHAPED = /secret|token|key|password|credential|signature|apikey/i;

// What a person types when they are looking for something, per table.
const SEARCHABLE = Object.freeze([
  Object.freeze({
    table: "business_bookings",
    label: "Bookings",
    path: "/business-builder/owner/bookings",
    columns: ["customer_name", "customer_email", "customer_phone", "notes"],
    display: (row) => row.customer_name || row.customer_email || "Booking"
  }),
  Object.freeze({
    table: "business_service_catalog",
    label: "Services",
    path: "/business-builder/owner/services",
    columns: ["name", "category", "description"],
    display: (row) => row.name || "Service"
  }),
  Object.freeze({
    table: "business_locations",
    label: "Locations",
    path: "/business-builder/owner/locations",
    columns: ["name", "address_line1", "city", "postal_code", "phone", "email"],
    display: (row) => row.name || row.address_line1 || "Location"
  }),
  Object.freeze({
    table: "business_employee_profiles",
    label: "Staff",
    path: "/business-builder/owner/staff",
    columns: ["display_name", "employee_number", "email", "phone", "job_title"],
    display: (row) => row.display_name || row.employee_number || "Staff member"
  }),
  Object.freeze({
    table: "inventory_items",
    label: "Inventory",
    path: "/business-builder/owner/inventory",
    columns: ["name", "sku", "category"],
    display: (row) => row.name || row.sku || "Item"
  }),
  Object.freeze({
    table: "vendor_accounts",
    label: "Vendors",
    path: "/business-builder/owner/vendors",
    columns: ["name", "account_number"],
    display: (row) => row.name || row.account_number || "Vendor"
  }),
  Object.freeze({
    table: "vendor_invoices",
    label: "Supplier invoices",
    path: "/business-builder/owner/invoices",
    columns: ["invoice_number"],
    display: (row) => row.invoice_number || "Invoice"
  }),
  Object.freeze({
    table: "menu_items",
    label: "Menu",
    path: "/business-builder/owner/menu",
    columns: ["name", "category"],
    display: (row) => row.name || "Dish"
  }),
  Object.freeze({
    table: "recipe_cards",
    label: "Recipes",
    path: "/business-builder/owner/recipes",
    columns: ["name"],
    display: (row) => row.name || "Recipe"
  }),
  Object.freeze({
    table: "vehicle_records",
    label: "Vehicles",
    path: "/business-builder/owner/vehicles",
    columns: ["make", "model", "plate_number", "vin"],
    display: (row) => [row.make, row.model].filter(Boolean).join(" ") || row.plate_number || "Vehicle"
  }),
  Object.freeze({
    table: "growth_leads",
    label: "Leads",
    path: "/growth-studio/leads",
    columns: ["name", "email", "phone", "source"],
    display: (row) => row.name || row.email || "Lead"
  }),
  Object.freeze({
    table: "growth_campaigns",
    label: "Campaigns",
    path: "/growth-studio/campaigns",
    columns: ["name", "goal", "channel"],
    display: (row) => row.name || "Campaign"
  })
]);

// Every column checked against the migrations, and every one checked against
// the secret shape. A search that names a column PostgREST does not have
// returns an error the page would render as "no results", which is the worst
// possible answer -- it looks like the record is not there.
function validate() {
  const problems = [];
  for (const entry of SEARCHABLE) {
    const available = columnNames(entry.table);
    if (available.length === 0) {
      problems.push(`${entry.table}: no such table in supabase/migrations`);
      continue;
    }
    if (!available.includes("organization_id")) {
      problems.push(`${entry.table}: no organization_id, so a search of it could not be scoped to one business`);
    }
    if (!available.includes("id")) problems.push(`${entry.table}: no id column`);
    for (const column of entry.columns) {
      if (!available.includes(column)) problems.push(`${entry.table}: no column ${column}`);
      if (SECRET_SHAPED.test(column)) problems.push(`${entry.table}: ${column} is secret-shaped and must not be searchable`);
    }
    if (entry.columns.length === 0) problems.push(`${entry.table}: nothing to search by`);
  }
  return problems;
}

// PostgREST escaping. A term reaches the query string, so the characters that
// mean something to PostgREST have to stop meaning it: a comma separates
// filters inside or=(), parentheses close the group, and a dot separates
// operator from value.
function escapeTerm(term) {
  return String(term == null ? "" : term)
    .replace(/[,()."'\\*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Two characters is the floor. One character matches most rows in most tables,
// which is a result list that is technically correct and useless.
const MINIMUM_TERM = 2;
const PER_TABLE_LIMIT = 10;

function isUsableTerm(term) {
  return escapeTerm(term).length >= MINIMUM_TERM;
}

// The query for one table. organization_id is a separate filter rather than
// part of the or() group -- inside the group it would be one alternative among
// many, which is the difference between "this business's bookings matching
// Smith" and "every business's bookings".
function queryFor(entry, term, organizationId) {
  const safe = escapeTerm(term);
  const select = [...new Set(["id", ...entry.columns])].join(",");
  const matches = entry.columns.map((column) => `${column}.ilike.*${encodeURIComponent(safe)}*`).join(",");
  return `?select=${select}&organization_id=eq.${encodeURIComponent(organizationId)}&or=(${matches})&limit=${PER_TABLE_LIMIT}`;
}

// Which column actually matched, so a result can say why it is there. A hit on
// a phone number when the owner typed a name is a hit worth explaining.
function matchedField(entry, row, term) {
  const needle = escapeTerm(term).toLowerCase();
  for (const column of entry.columns) {
    const value = row[column];
    if (value && String(value).toLowerCase().includes(needle)) return { column, value: String(value) };
  }
  return null;
}

function summarise(groups, term) {
  const found = groups.filter((group) => group.rows.length > 0);
  const total = found.reduce((sum, group) => sum + group.rows.length, 0);
  const unavailable = groups.filter((group) => group.unavailable).length;
  return {
    term: escapeTerm(term),
    groups: found,
    total,
    unavailable,
    // A table that could not be read is not a table with no matches. Saying so
    // is the difference between "not found" and "not looked".
    searched: groups.length - unavailable
  };
}

module.exports = {
  SEARCHABLE,
  MINIMUM_TERM,
  PER_TABLE_LIMIT,
  validate,
  escapeTerm,
  isUsableTerm,
  queryFor,
  matchedField,
  summarise
};
