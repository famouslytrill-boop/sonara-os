"use strict";

// Which columns each table actually has, read from supabase/migrations/.
//
// This exists because of a bug it would have caught. The generic record
// endpoints in routes/sonara-last9-routes.cjs built every insert payload as:
//
//     { ...defaults, ...body, organization_id, user_id: org.userId || null }
//
// and seventeen of the nineteen tables behind those endpoints have no user_id
// column. PostgREST rejects an insert naming a column that is not there, so
// every one of those forms failed to save: a customer filled in a location, a
// service, a booking, an inventory item or a vendor, submitted it, and was
// redirected back to the page with ?problem= and no record.
//
// Nothing caught it. The tests stub Supabase and a stub accepts any payload, so
// the shape of what gets sent was never compared against the shape of what
// exists. tests/owner-record-inserts.test.js does that comparison now, using
// this module as the source of truth for the second half of it.
//
// The parsing is deliberately literal: create table blocks for the initial
// columns, alter table ... add column for the ones added later, both of which
// this schema uses. It reads repo files, not input. A table it cannot parse
// returns null rather than an empty set, so a caller can tell "no columns
// found" apart from "this table is not in the migrations", and a check built on
// it fails loudly instead of passing on nothing.

const fs = require("node:fs");
const path = require("node:path");

const MIGRATIONS = path.join(__dirname, "..", "supabase", "migrations");

// The line inside a create table block is a column definition unless it opens
// with one of these -- table constraints, not columns.
const NOT_A_COLUMN = /^(--|unique|check|primary|constraint|foreign|exclude|like)\b/i;

const CREATE_TABLE = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z0-9_]+)"?\s*\(([\s\S]*?)\n\s*\);/gi;
const ADD_COLUMN = /alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?"?([a-z0-9_]+)"?\s+add\s+column\s+(?:if\s+not\s+exists\s+)?"?([a-z0-9_]+)"?/gi;

let cache = null;
// name -> description, alongside the name-only set the original callers use.
const details = new Map();

function readMigrationSource() {
  if (!fs.existsSync(MIGRATIONS)) return "";
  return fs.readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => fs.readFileSync(path.join(MIGRATIONS, name), "utf8"))
    .join("\n");
}

// Everything a form needs to offer a field that the database will accept: the
// type, whether it is required, and the values a check constraint allows.
// Deriving these is the difference between a form built from the schema and one
// hand-written beside it, which drifts the first time a column changes.
function describeColumn(line) {
  const name = line.split(/[\s(]/)[0].replace(/"/g, "").toLowerCase();
  const rest = line.slice(name.length).toLowerCase();
  const type = /\buuid\b/.test(rest) ? "uuid"
    : /\bjsonb?\b/.test(rest) ? "json"
      : /\bbool(ean)?\b/.test(rest) ? "boolean"
        : /\b(numeric|integer|bigint|int|real|double|decimal|smallint)\b/.test(rest) ? "number"
          : /\btimestamptz?\b|\btimestamp\b/.test(rest) ? "timestamp"
            : /\bdate\b/.test(rest) ? "date"
              : "text";
  // check (x in ('a','b')) -- the allowed values, so a form offers a choice
  // rather than a free-text box the database will reject.
  const allowed = [...(line.match(/check\s*\([^)]*\bin\s*\(([^)]*)\)/i)?.[1] || "").matchAll(/'([^']*)'/g)].map((entry) => entry[1]);
  const fallback = line.match(/default\s+'([^']*)'/i)?.[1] || null;
  return {
    name,
    type,
    required: /\bnot\s+null\b/i.test(rest) && !/\bdefault\b/i.test(rest),
    generated: /\bdefault\s+(gen_random_uuid|now)\s*\(/i.test(rest) || /\bprimary\s+key\b/i.test(rest),
    allowed,
    fallback
  };
}

function buildTableColumns() {
  const source = readMigrationSource();
  const tables = new Map();

  for (const match of source.matchAll(CREATE_TABLE)) {
    const table = match[1].toLowerCase();
    if (tables.has(table)) continue; // first definition wins, as it does in a replay
    const columns = new Set();
    const described = new Map();
    for (const line of match[2].split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || NOT_A_COLUMN.test(trimmed)) continue;
      const name = trimmed.split(/[\s(]/)[0].replace(/"/g, "").toLowerCase();
      if (!/^[a-z_][a-z0-9_]*$/.test(name)) continue;
      columns.add(name);
      described.set(name, describeColumn(trimmed));
    }
    tables.set(table, columns);
    details.set(table, described);
  }

  // Columns added after the table was created. Applied to every table named,
  // including ones whose create block lives in another file.
  for (const match of source.matchAll(ADD_COLUMN)) {
    const table = match[1].toLowerCase();
    if (!tables.has(table)) tables.set(table, new Set());
    tables.get(table).add(match[2].toLowerCase());
  }

  return tables;
}

function tableColumns(table) {
  if (!cache) cache = buildTableColumns();
  const columns = cache.get(String(table || "").toLowerCase());
  return columns ? new Set(columns) : null;
}

function hasColumn(table, column) {
  const columns = tableColumns(table);
  return Boolean(columns && columns.has(String(column || "").toLowerCase()));
}

// The described columns for a table, in declaration order. Columns added by a
// later `alter table` are known by name but not described, so they are omitted
// rather than guessed at -- a form field with a made-up type is worse than a
// missing one.
function describedColumns(table) {
  if (!cache) cache = buildTableColumns();
  const described = details.get(String(table || "").toLowerCase());
  return described ? [...described.values()] : [];
}

function knownTables() {
  if (!cache) cache = buildTableColumns();
  return [...cache.keys()].sort();
}

module.exports = { tableColumns, describedColumns, hasColumn, knownTables };
