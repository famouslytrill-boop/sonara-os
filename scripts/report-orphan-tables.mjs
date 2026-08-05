#!/usr/bin/env node
// Which tables the migrations create that the application never queries.
//
// docs/WORKSPACE_WORKFLOW_AUDIT.md reported 206 of 300. That number could not be
// reproduced, and the reason matters more than the number: "named anywhere in
// the application source" depends entirely on which files count as source.
//
//   Counting docs/ makes it 0, because the audit itself lists every orphan by
//   name.
//   Counting lib/sonara-database-contract.cjs and
//   lib/sonara-tenant-scoped-tables.cjs makes it 0 too -- those are generated
//   inventories that name every table by construction.
//   Excluding the generated inventories, and not counting a name that only
//   appears in a comment, gives 90 -- 87 after three of them became workspaces
//   in the same change that added this script.
//
// So this script fixes the definition rather than the count. A table is orphaned
// when no file that actually queries something names it. The generated
// inventories are excluded because a table appearing in a list of all tables is
// not evidence that anything uses it.
//
// --check fails when an orphan appears that lib/sonara-orphan-tables.cjs does
// not account for. That is the durable part: the existing 87 are a decision for
// the owner, but an eighty-eighth arriving unnoticed is a regression, and adding
// a table nothing reads is how this set grew to begin with.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const { ORPHAN_TABLES, ORPHAN_DISPOSITIONS } = require(path.join(root, "lib", "sonara-orphan-tables.cjs"));

// Generated inventories. They enumerate every table, so counting them as usage
// makes the measure report zero orphans forever.
const INVENTORIES = [
  "lib/sonara-database-contract.cjs",
  "lib/sonara-tenant-scoped-tables.cjs",
  "lib/sonara-member-read-policies.cjs",
  "lib/sonara-orphan-tables.cjs",
  "scripts/generate-tenant-scoped-tables.cjs",
  "scripts/generate-member-read-policies.cjs",
  "scripts/report-orphan-tables.mjs",
  "scripts/verify-production-schema.mjs",
  "scripts/verify-supabase-contract.mjs"
];

const SOURCE_DIRS = ["lib", "routes", "api", "scripts", "data", "public", "openapi"];
const SOURCE_FILES = /\.(cjs|js|mjs|ts|tsx|json)$/;

function createdTables() {
  const dir = path.join(root, "supabase", "migrations");
  const tables = new Set();
  for (const name of fs.readdirSync(dir).filter((file) => file.endsWith(".sql")).sort()) {
    const sql = fs.readFileSync(path.join(dir, name), "utf8");
    for (const match of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z0-9_]+)"?/gi)) {
      tables.add(match[1].toLowerCase());
    }
  }
  return tables;
}

// A table named in a comment is not a table anything reads. The first run of
// this script reported purchase_order_lines, inventory_count_lines and
// location_transfer_lines as newly queried, when all three had only been named
// in a comment explaining why they deliberately have no page. Stripping
// comments is the difference between measuring usage and measuring mentions.
function withoutComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

function applicationSource() {
  let source = withoutComments(fs.readFileSync(path.join(root, "server.js"), "utf8"));
  const walk = (relative) => {
    const absolute = path.join(root, relative);
    if (!fs.existsSync(absolute)) return;
    for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
      if (["node_modules", "archive", ".git", ".next"].includes(entry.name)) continue;
      const next = path.join(relative, entry.name);
      if (entry.isDirectory()) walk(next);
      else if (SOURCE_FILES.test(entry.name) && !INVENTORIES.includes(next.split(path.sep).join("/"))) {
        source += "\n" + withoutComments(fs.readFileSync(path.join(root, next), "utf8"));
      }
    }
  };
  for (const dir of SOURCE_DIRS) walk(dir);
  return source;
}

const created = createdTables();
const source = applicationSource();
const orphans = [...created].filter((table) => !new RegExp(`\\b${table}\\b`).test(source)).sort();

const check = process.argv.includes("--check");
const accounted = new Set(ORPHAN_TABLES);
const unaccounted = orphans.filter((table) => !accounted.has(table));
// A table that was orphaned, is listed, and is now queried. Not a failure --
// it means somebody built the workspace -- but the list should not keep
// claiming it is unused.
const resolved = ORPHAN_TABLES.filter((table) => created.has(table) && !orphans.includes(table));
const missing = ORPHAN_TABLES.filter((table) => !created.has(table));

if (!check) {
  const groups = new Map();
  for (const table of orphans) {
    const disposition = ORPHAN_DISPOSITIONS[table] || { group: "unclassified", decision: "none recorded" };
    if (!groups.has(disposition.group)) groups.set(disposition.group, []);
    groups.get(disposition.group).push(table);
  }
  console.log(`${created.size} tables created, ${created.size - orphans.length} queried, ${orphans.length} never queried.\n`);
  for (const [group, tables] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`${group} (${tables.length})`);
    console.log(`  ${tables.join(", ")}\n`);
  }
  if (resolved.length) console.log(`Now queried, so no longer orphaned: ${resolved.join(", ")}`);
}

const problems = [];
if (unaccounted.length) {
  problems.push(`these tables are created and never queried, and lib/sonara-orphan-tables.cjs does not account for them:\n  ${unaccounted.join("\n  ")}\n  Add each with a group and a decision, or make something query it.`);
}
if (resolved.length) {
  problems.push(`these are listed as never queried and now are queried:\n  ${resolved.join("\n  ")}\n  Remove them from lib/sonara-orphan-tables.cjs.`);
}
if (missing.length) {
  problems.push(`these are listed but no migration creates them:\n  ${missing.join("\n  ")}`);
}
// If the reader ever stops finding tables, everything above passes on nothing.
if (created.size < 200) {
  problems.push(`only ${created.size} tables parsed from supabase/migrations; this check has gone blind.`);
}

if (problems.length) {
  console.error(`\nOrphan table check failed.\n\n${problems.join("\n\n")}`);
  process.exit(1);
}

if (check) console.log(`Orphan table check passed: ${orphans.length} unused tables, all accounted for with a recorded decision.`);
