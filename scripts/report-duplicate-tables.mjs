#!/usr/bin/env node
// Which tables the migrations create twice under different names.
//
// `employee_shifts` was found to duplicate `employee_schedules` on 1 October
// 2026 -- same organization_id, employee_id, location_id, role_label, starts_at,
// ends_at and notes, differing only in their status vocabulary -- while reading
// the migrations for something else. One of the two has a product behind it and
// the other has no reader at all.
//
// Nothing would have found the next one, and "no duplicate tables" is not a
// property anybody can hold in their head across 348 of them.
//
// ## What is compared, and what is deliberately not
//
// Column names, not types. Two tables with the same column names and different
// types are still the same idea stored twice, and comparing declared types would
// make the measure sensitive to `text` against `varchar` in a way that hides the
// thing it is looking for.
//
// The columns almost every table has are removed before comparing: `id`,
// `organization_id`, `created_at`, `updated_at`, `metadata`, `user_id`,
// `created_by`, `notes`, `status`. Two tables that share only those share
// nothing -- leaving them in makes every pair of small tables look alike, which
// is how a check ends up with a register nobody reads.
//
// ## Why a floor on the remaining column count
//
// After stripping, a table with one distinctive column left would match every
// other table with that one column. Those are not duplicates, they are tables
// with little in them, so a pair is only compared when both sides have at least
// MINIMUM_DISTINCTIVE_COLUMNS remaining. Reported in the summary, because a
// floor that silently excludes most of the schema is a check that passes by
// measuring nothing.
//
// --check fails when a near-duplicate pair appears that
// lib/sonara-duplicate-table-review.cjs does not account for, AND when a
// reviewed pair has stopped being near-duplicate -- so the register cannot
// outlive its reasons.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const { withoutSqlComments } = require(path.join(root, "lib", "sonara-comment-stripping.cjs"));
const { DUPLICATE_TABLE_REVIEWS } = require(path.join(root, "lib", "sonara-duplicate-table-review.cjs"));

// Shared by almost everything, so shared-ness here says nothing.
const COMMON_COLUMNS = new Set([
  "id", "organization_id", "created_at", "updated_at", "metadata",
  "user_id", "created_by", "notes", "status"
]);

// Below this, a table has too little left to be meaningfully compared.
const MINIMUM_DISTINCTIVE_COLUMNS = 4;

// Jaccard overlap of the distinctive columns. 0.8 was chosen by measuring:
// employee_schedules against employee_shifts scores 1.0, and the next-highest
// unrelated pair in this repository scores well below it. The gap is printed in
// the summary so the next person can see whether it has closed.
const NEAR_DUPLICATE_THRESHOLD = 0.8;

function migrationSql() {
  const directory = path.join(root, "supabase", "migrations");
  const files = fs.readdirSync(directory).filter((name) => name.endsWith(".sql")).sort();
  if (files.length < 50) {
    console.error(`ERROR: only ${files.length} migrations found; this check has gone blind.`);
    process.exit(1);
  }
  return { files, sql: files.map((name) => fs.readFileSync(path.join(directory, name), "utf8")).join("\n") };
}

// The same terminator and the same over-run guard as
// scripts/generate-tenant-scoped-tables.cjs, for the same reason: a CREATE TABLE
// body that swallows the next table makes every column set below it wrong, and
// the quiet version of that cost the receivables table its tenant guarantee.
function columnsByTable(sql) {
  const stripped = withoutSqlComments(sql);
  const createPattern = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z0-9_]+)\s*\(([\s\S]*?)\n\s*\)\s*;/gi;
  const tables = new Map();
  const overrun = [];
  for (const match of stripped.matchAll(createPattern)) {
    const [, rawName, body] = match;
    const name = rawName.toLowerCase();
    if (/create\s+table/i.test(body)) overrun.push(name);
    const columns = tables.get(name) || new Set();
    for (const line of body.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(")")) continue;
      // A constraint clause is not a column.
      if (/^(primary\s+key|unique|constraint|check|foreign\s+key|exclude)\b/i.test(trimmed)) continue;
      const column = trimmed.match(/^"?([a-z0-9_]+)"?\s+/i);
      if (column) columns.add(column[1].toLowerCase());
    }
    tables.set(name, columns);
  }
  if (overrun.length) {
    console.error(
      `ERROR: CREATE TABLE parsing over-ran on: ${overrun.join(", ")}. `
      + "Each of those swallowed at least one following table, so the column sets below them are wrong."
    );
    process.exit(1);
  }

  // Columns added later count too. A table made identical to another by an
  // ALTER is still identical.
  const alterPattern = /alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(?:public\.)?([a-z0-9_]+)\s+add\s+column\s+(?:if\s+not\s+exists\s+)?"?([a-z0-9_]+)"?/gi;
  for (const match of stripped.matchAll(alterPattern)) {
    const name = match[1].toLowerCase();
    if (!tables.has(name)) continue;
    tables.get(name).add(match[2].toLowerCase());
  }

  // And dropped tables are not part of the schema to compare.
  for (const match of stripped.matchAll(/drop\s+table\s+(?:if\s+exists\s+)?(?:public\.|retired\.)?"?([a-z0-9_]+)"?/gi)) {
    tables.delete(match[1].toLowerCase());
  }
  return tables;
}

function distinctive(columns) {
  return new Set([...columns].filter((column) => !COMMON_COLUMNS.has(column)));
}

function overlap(left, right) {
  const shared = [...left].filter((column) => right.has(column)).length;
  const union = new Set([...left, ...right]).size;
  return union === 0 ? 0 : shared / union;
}

const { files, sql } = migrationSql();
const tables = columnsByTable(sql);
if (tables.size < 100) {
  console.error(`ERROR: only ${tables.size} tables parsed from ${files.length} migrations; this check has gone blind.`);
  process.exit(1);
}

const comparable = [...tables.entries()]
  .map(([name, columns]) => [name, distinctive(columns)])
  .filter(([, columns]) => columns.size >= MINIMUM_DISTINCTIVE_COLUMNS)
  .sort(([a], [b]) => a.localeCompare(b));

if (comparable.length < 50) {
  console.error(
    `ERROR: only ${comparable.length} of ${tables.size} tables have ${MINIMUM_DISTINCTIVE_COLUMNS} distinctive columns, `
    + "so almost nothing is being compared. Lower the floor or widen COMMON_COLUMNS deliberately rather than leaving this."
  );
  process.exit(1);
}

const pairs = [];
for (let i = 0; i < comparable.length; i += 1) {
  for (let j = i + 1; j < comparable.length; j += 1) {
    const [leftName, leftColumns] = comparable[i];
    const [rightName, rightColumns] = comparable[j];
    const score = overlap(leftColumns, rightColumns);
    if (score >= NEAR_DUPLICATE_THRESHOLD) {
      pairs.push({ tables: [leftName, rightName], score, shared: [...leftColumns].filter((c) => rightColumns.has(c)).sort() });
    }
  }
}
pairs.sort((a, b) => b.score - a.score || a.tables[0].localeCompare(b.tables[0]));

const key = ([a, b]) => [a, b].slice().sort().join(" + ");
const reviewed = new Map(DUPLICATE_TABLE_REVIEWS.map((entry) => [key(entry.tables), entry]));
const found = new Map(pairs.map((pair) => [key(pair.tables), pair]));

const unreviewed = pairs.filter((pair) => !reviewed.has(key(pair.tables)));
const stale = [...reviewed.values()].filter((entry) => !found.has(key(entry.tables)));

// The highest-scoring pair that is NOT near-duplicate, so the gap between
// "reported" and "ignored" is visible rather than asserted.
let runnerUp = { score: 0, tables: ["", ""] };
for (let i = 0; i < comparable.length; i += 1) {
  for (let j = i + 1; j < comparable.length; j += 1) {
    const score = overlap(comparable[i][1], comparable[j][1]);
    if (score < NEAR_DUPLICATE_THRESHOLD && score > runnerUp.score) {
      runnerUp = { score, tables: [comparable[i][0], comparable[j][0]] };
    }
  }
}

const check = process.argv.includes("--check");

console.log(
  `Duplicate-table report: ${tables.size} tables from ${files.length} migrations, `
  + `${comparable.length} with at least ${MINIMUM_DISTINCTIVE_COLUMNS} distinctive columns and therefore compared, `
  + `${pairs.length} pair(s) at or above ${NEAR_DUPLICATE_THRESHOLD} overlap, ${reviewed.size} reviewed.`
);
console.log(
  `  Highest overlap below the threshold: ${runnerUp.tables.join(" + ")} at ${runnerUp.score.toFixed(2)} `
  + "-- the gap between what is reported and what is not."
);
for (const pair of pairs) {
  const entry = reviewed.get(key(pair.tables));
  console.log(`  ${pair.score.toFixed(2)}  ${pair.tables.join(" + ")}  shared: ${pair.shared.join(", ")}`);
  if (entry) console.log(`        reviewed as ${entry.verdict}`);
}

let failed = false;
if (unreviewed.length) {
  failed = true;
  console.error("\nERROR: these table pairs are near-duplicates and are not accounted for in lib/sonara-duplicate-table-review.cjs:");
  for (const pair of unreviewed) {
    console.error(`  ${pair.tables.join(" + ")} (${pair.score.toFixed(2)} overlap) shared: ${pair.shared.join(", ")}`);
  }
  console.error("\nEither retire one of each pair, or record it there with what it is and why it stays.");
}
if (stale.length) {
  failed = true;
  console.error("\nERROR: these reviewed pairs are no longer near-duplicates, so their entries no longer excuse anything:");
  for (const entry of stale) console.error(`  ${entry.tables.join(" + ")} -- recorded reason: ${entry.reason.slice(0, 90)}...`);
  console.error("\nRemove them. An exemption that outlives its reason is what the next reader believes instead of checking.");
}

if (check && failed) process.exit(1);
if (failed) process.exit(1);
