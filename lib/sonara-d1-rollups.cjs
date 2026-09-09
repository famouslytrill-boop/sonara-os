"use strict";

// The derived tables D1 exists to hold, and the rules for reading them.
//
// `lib/sonara-d1-adapter.cjs` refuses any statement naming a table Supabase
// owns. That says what D1 may not hold. This says what it may, and the schema
// below is the whole of it: two tables, both recomputable from Supabase in
// their entirety, both worthless to steal.
//
// ## Why a rollup table needs more columns than the numbers it holds
//
// A rollup that stores only totals cannot answer the question anybody actually
// asks of it, which is "is this still true?". So every row carries `computed_at`
// and `source_rows`: when it was built, and how many Supabase rows went into it.
// A total of zero built from four thousand rows is a real zero. A total of zero
// built from no rows is a rollup that ran against nothing, and the two look
// identical without that column.
//
// This is shape 4 from `.claude/skills/checks-that-cannot-lie` -- absent read as
// zero -- moved into a schema. `Number(null)` is `0` and finite, which is how
// unpriced services once read as free across twenty-three columns here. A
// missing rollup row must mean "not computed", never "nothing happened". This
// module builds statements rather than running them, so what it can enforce is
// that `source_rows` is NOT NULL in the schema and required by
// `writeDailyTotalsStatement` -- a caller who cannot say how many rows it read
// cannot write a total at all. Whoever renders these rows owes the reader the
// same distinction: no row is "not computed yet", not "nothing happened".
//
// ## The tenant boundary, which D1 does not have
//
// Supabase at least has row-level security to bypass. D1 has none: there are no
// policies, no roles, and no `auth.uid()`. The organization boundary in this
// database is `organization_id` in a WHERE clause and nothing else, which means
// a helper that forgets it is a cross-tenant read with no second line of
// defence behind it.
//
// So no helper here takes an optional organization. Every read and every write
// requires one, refuses a blank one, and puts it in the statement itself.
// `tests/the-rollups-cannot-read-another-organization.test.js` asserts that of
// every exported statement builder rather than of the ones somebody remembered.
//
// ## What losing this database costs
//
// A recomputation. That is the test any table proposed for this file has to
// pass: if losing it would lose something, it belongs in Supabase.

const { TENANT_SCOPED_TABLES, GLOBAL_TABLES } = require("./sonara-tenant-scoped-tables.cjs");

const RESERVED = new Set([...TENANT_SCOPED_TABLES, ...GLOBAL_TABLES].map((name) => String(name).toLowerCase()));

// Every table and column below was checked against those 325 names rather than
// eyeballed, and `bookings` is why: it is a Supabase table, so a column called
// `bookings` would be refused by the adapter at read time with a message about
// system-of-record boundaries that would take somebody an hour to connect to a
// column name. `bookings_made` is a different identifier and passes.
const DAILY_TOTALS_COLUMNS = Object.freeze([
  "organization_id",
  "day",
  "bookings_made",
  "invoices_issued",
  "invoiced_cents",
  "paid_cents",
  "customers_added",
  "source_rows",
  "computed_at"
]);

const RUN_COLUMNS = Object.freeze([
  "rollup_name",
  "organization_id",
  "window_start",
  "window_end",
  "started_at",
  "finished_at",
  "run_status",
  "source_rows",
  "detail"
]);

const TABLES = Object.freeze(["rollup_daily_totals", "rollup_runs"]);

/**
 * The schema, as statements rather than one script.
 *
 * One statement each because the adapter refuses more than one per call -- and
 * that refusal is worth keeping rather than working around, since "only one
 * statement" is what stops a query parameter from carrying a second.
 */
const SCHEMA_STATEMENTS = Object.freeze([
  `CREATE TABLE IF NOT EXISTS rollup_daily_totals (
    organization_id TEXT NOT NULL,
    day TEXT NOT NULL,
    bookings_made INTEGER NOT NULL DEFAULT 0,
    invoices_issued INTEGER NOT NULL DEFAULT 0,
    invoiced_cents INTEGER NOT NULL DEFAULT 0,
    paid_cents INTEGER NOT NULL DEFAULT 0,
    customers_added INTEGER NOT NULL DEFAULT 0,
    source_rows INTEGER NOT NULL,
    computed_at TEXT NOT NULL,
    PRIMARY KEY (organization_id, day)
  )`,
  // Money is stored in cents as an integer, never as a float. SQLite's REAL is
  // a double, and a double cannot hold 0.1. An invoice total that depends on
  // binary rounding is the kind of defect that is found by a customer.
  `CREATE INDEX IF NOT EXISTS rollup_daily_totals_by_day ON rollup_daily_totals (organization_id, day DESC)`,
  `CREATE TABLE IF NOT EXISTS rollup_runs (
    rollup_name TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    window_start TEXT NOT NULL,
    window_end TEXT NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    run_status TEXT NOT NULL,
    source_rows INTEGER,
    detail TEXT,
    PRIMARY KEY (rollup_name, organization_id, window_start)
  )`,
  `CREATE INDEX IF NOT EXISTS rollup_runs_by_started ON rollup_runs (organization_id, started_at DESC)`
]);

// Three states, and the fourth is the absence of a row.
//
// `running` means a rollup started and has not reported back. `complete` means
// it finished and the totals for that window are current. `failed` means it
// finished and they are not. No row at all means it never ran, which is a
// different fact from all three and the one most likely to be misread as zero.
const RUN_STATUSES = Object.freeze(["running", "complete", "failed"]);

function requireOrganization(organizationId) {
  if (typeof organizationId !== "string" || !organizationId.trim()) {
    return "A rollup read or write needs an organization id. D1 has no row-level security, so this is the only boundary there is.";
  }
  return "";
}

// A day is stored as YYYY-MM-DD text rather than a date type, because SQLite has
// no date type and a string that sorts correctly is the whole requirement.
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A row limit, or the default when the caller gave something that is not one.
 *
 * The obvious spelling -- `Math.min(Math.max(Number(limit) || fallback, 1), max)`
 * -- was here first and is wrong in a quiet way: a negative limit is truthy, so
 * it survives the `||`, and `Math.max(-5, 1)` clamps it to **1**. The caller
 * asks for a bad limit and gets a single row back, which reads as "that is all
 * the data there is" rather than as an error. A bad limit falls back to the
 * default instead, which is the value a caller who said nothing would get.
 */
function boundedLimit(limit, fallback, max) {
  const value = Number(limit);
  if (!Number.isFinite(value) || value < 1) return fallback;
  return Math.min(Math.floor(value), max);
}

/**
 * Read one organization's daily totals for a window.
 *
 * Returns a statement and its parameters rather than running anything, so the
 * caller passes it to the D1 adapter and this module stays testable without a
 * database. Returns `{ ok: false, detail }` when the inputs are unusable.
 */
function readDailyTotalsStatement({ organizationId, from, to, limit = 90 }) {
  const missing = requireOrganization(organizationId);
  if (missing) return { ok: false, detail: missing };
  if (from && !DAY_PATTERN.test(from)) return { ok: false, detail: "`from` must be a YYYY-MM-DD day." };
  if (to && !DAY_PATTERN.test(to)) return { ok: false, detail: "`to` must be a YYYY-MM-DD day." };

  const bounded = boundedLimit(limit, 90, 366);
  const where = ["organization_id = ?"];
  const params = [organizationId];
  if (from) {
    where.push("day >= ?");
    params.push(from);
  }
  if (to) {
    where.push("day <= ?");
    params.push(to);
  }

  return {
    ok: true,
    sql: `SELECT ${DAILY_TOTALS_COLUMNS.join(", ")} FROM rollup_daily_totals WHERE ${where.join(" AND ")} ORDER BY day DESC LIMIT ${bounded}`,
    params
  };
}

/**
 * Write one day's totals for one organization.
 *
 * An upsert, because a rollup is recomputed rather than appended: running it
 * twice for the same day must leave one row, not two. `source_rows` is required
 * rather than defaulted -- a caller that does not know how many rows it read
 * cannot say whether its zero is a real one.
 */
function writeDailyTotalsStatement({ organizationId, day, totals = {}, sourceRows, computedAt }) {
  const missing = requireOrganization(organizationId);
  if (missing) return { ok: false, detail: missing };
  if (!DAY_PATTERN.test(String(day || ""))) return { ok: false, detail: "`day` must be a YYYY-MM-DD day." };
  if (!Number.isInteger(sourceRows) || sourceRows < 0) {
    return { ok: false, detail: "`sourceRows` must be a whole number: a total with no row count behind it cannot be told from an unrun rollup." };
  }

  const counted = ["bookings_made", "invoices_issued", "invoiced_cents", "paid_cents", "customers_added"];
  const values = [];
  for (const column of counted) {
    const value = totals[column];
    if (value === undefined) {
      values.push(0);
      continue;
    }
    if (!Number.isInteger(value) || value < 0) {
      return { ok: false, detail: `\`${column}\` must be a whole number of items or cents, never a float.` };
    }
    values.push(value);
  }

  return {
    ok: true,
    sql:
      `INSERT INTO rollup_daily_totals (${DAILY_TOTALS_COLUMNS.join(", ")}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ` +
      "ON CONFLICT (organization_id, day) DO UPDATE SET " +
      counted.map((column) => `${column} = excluded.${column}`).join(", ") +
      ", source_rows = excluded.source_rows, computed_at = excluded.computed_at",
    params: [organizationId, day, ...values, sourceRows, computedAt || new Date().toISOString()]
  };
}

/** Record that a rollup started, finished, or failed. */
function recordRunStatement({ rollupName, organizationId, windowStart, windowEnd, runStatus, sourceRows = null, detail = null, at }) {
  const missing = requireOrganization(organizationId);
  if (missing) return { ok: false, detail: missing };
  if (!rollupName || typeof rollupName !== "string") return { ok: false, detail: "`rollupName` is required." };
  if (!RUN_STATUSES.includes(runStatus)) {
    return { ok: false, detail: `\`runStatus\` must be one of ${RUN_STATUSES.join(", ")}. No row at all is the fourth state and means it never ran.` };
  }

  const now = at || new Date().toISOString();
  const finished = runStatus === "running" ? null : now;

  return {
    ok: true,
    sql:
      `INSERT INTO rollup_runs (${RUN_COLUMNS.join(", ")}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ` +
      "ON CONFLICT (rollup_name, organization_id, window_start) DO UPDATE SET " +
      "window_end = excluded.window_end, finished_at = excluded.finished_at, run_status = excluded.run_status, " +
      "source_rows = excluded.source_rows, detail = excluded.detail",
    params: [rollupName, organizationId, windowStart, windowEnd, now, finished, runStatus, sourceRows, detail]
  };
}

/** The last run of each rollup for one organization, so staleness is visible. */
function readRunsStatement({ organizationId, limit = 20 }) {
  const missing = requireOrganization(organizationId);
  if (missing) return { ok: false, detail: missing };
  const bounded = boundedLimit(limit, 20, 200);
  return {
    ok: true,
    sql: `SELECT ${RUN_COLUMNS.join(", ")} FROM rollup_runs WHERE organization_id = ? ORDER BY started_at DESC LIMIT ${bounded}`,
    params: [organizationId]
  };
}

/**
 * Every identifier this schema introduces, for the test that checks none of
 * them collides with a table Supabase owns.
 *
 * Derived from the same constants the statements are built from rather than
 * retyped, so a column added above is a column this returns.
 */
function declaredIdentifiers() {
  return [...TABLES, ...DAILY_TOTALS_COLUMNS, ...RUN_COLUMNS];
}

function collidingIdentifiers() {
  return declaredIdentifiers().filter((name) => RESERVED.has(name.toLowerCase()));
}

module.exports = {
  TABLES,
  DAILY_TOTALS_COLUMNS,
  RUN_COLUMNS,
  RUN_STATUSES,
  SCHEMA_STATEMENTS,
  DAY_PATTERN,
  readDailyTotalsStatement,
  writeDailyTotalsStatement,
  recordRunStatement,
  readRunsStatement,
  declaredIdentifiers,
  collidingIdentifiers
};
