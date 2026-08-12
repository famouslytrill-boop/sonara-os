"use strict";

// A table the code names and no migration creates.
//
// `pnpm run verify:orphan-tables` asks this question in one direction: which
// tables the migrations create that nothing queries. That is the harmless
// direction -- unused schema costs nothing but confusion. The dangerous
// direction was unasked: a table the application queries that no migration
// creates is a feature that cannot work, in production, forever.
//
// tests/tenant-isolation.test.js gets close. It walks every literal
// `/rest/v1/<name>` and fails on a name in neither generated table list, and it
// states its own limit honestly: "a /rest/v1/${table} is resolved at runtime
// and cannot be checked from here". True -- but the blind spot is wider than
// that sentence. `safeCountTable(config, "product_modules")` passes a string
// literal, so the name is knowable at rest; it just never appears next to
// /rest/v1/ because a helper builds the URL. That is how product_modules
// survived: named in server.js in July 2026, created by no migration since,
// and rendering "unavailable until Supabase tables are migrated" on an admin
// card the whole time -- a message promising a migration that was never
// coming. It should have been sonara_module_registry, which exists and is
// seeded.
//
// So this check does not look at request URLs. It looks at every place the code
// *declares* a name to be a table, whatever it does with it afterwards.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

// Generated inventories name every table by construction, so reading them would
// make this check agree with itself.
const INVENTORIES = ["lib/sonara-database-contract.cjs", "lib/sonara-tenant-scoped-tables.cjs"];

// Tables that exist at the end of a replay: created, minus dropped. Same rule
// as scripts/report-orphan-tables.mjs, which is where the drop handling and the
// reason for it are explained.
function tablesAfterReplay() {
  const dir = path.join(root, "supabase", "migrations");
  const created = new Set();
  const dropped = new Set();
  for (const name of fs.readdirSync(dir).filter((file) => file.endsWith(".sql")).sort()) {
    const sql = fs.readFileSync(path.join(dir, name), "utf8");
    for (const match of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z0-9_]+)"?/gi)) {
      created.add(match[1].toLowerCase());
    }
    for (const match of sql.matchAll(/drop\s+table\s+(?:if\s+exists\s+)?(?:public\.|retired\.)?"?([a-z0-9_]+)"?/gi)) {
      dropped.add(match[1].toLowerCase());
    }
    if (/drop\s+table\s+retired\.%I/i.test(sql)) {
      const list = sql.match(/superseded\s+constant\s+text\[\]\s*:=\s*array\[([\s\S]*?)\]/i);
      if (list) for (const entry of list[1].matchAll(/'([a-z0-9_]+)'/gi)) dropped.add(entry[1].toLowerCase());
    }
  }
  for (const table of dropped) created.delete(table);
  return created;
}

// A name in a comment is a mention, not a declaration -- the orphan report
// learned this when three tables named only in a comment explaining why they
// have no page were reported as newly queried.
function withoutComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

function runtimeFiles() {
  const files = ["server.js"];
  for (const dir of ["routes", "lib", "api"]) {
    const absolute = path.join(root, dir);
    if (!fs.existsSync(absolute)) continue;
    for (const name of fs.readdirSync(absolute)) {
      if (/\.(c?js|mjs)$/.test(name)) files.push(`${dir}/${name}`);
    }
  }
  return files.filter((file) => !INVENTORIES.includes(file));
}

// Every shape in which this codebase says "this string is a table".
const DECLARATIONS = [
  ["a PostgREST path", /\/rest\/v1\/([a-z0-9_]+)/g],
  ["a table: property", /\btable:\s*["']([a-z][a-z0-9_]{2,})["']/g],
  ["a table assignment", /\btable\s*=\s*["']([a-z][a-z0-9_]{2,})["']/g],
  ["a safeCountTable call", /safeCountTable\([^,]+,\s*["']([a-z][a-z0-9_]{2,})["']/g]
];

function declaredTables() {
  const found = new Map();
  const record = (table, file, how) => {
    if (table === "rpc") return;
    if (!found.has(table)) found.set(table, `${file} (${how})`);
  };

  for (const file of runtimeFiles()) {
    const source = withoutComments(fs.readFileSync(path.join(root, file), "utf8"));
    for (const [how, pattern] of DECLARATIONS) {
      for (const match of source.matchAll(pattern)) record(match[1], file, how);
    }
    // The TABLES maps that route files use to keep literal names out of the
    // call sites -- the same indirection that hid product_modules.
    for (const map of source.matchAll(/TABLES\s*=\s*Object\.freeze\(\{([\s\S]*?)\}\)/g)) {
      for (const entry of map[1].matchAll(/[A-Za-z0-9_]+\s*:\s*["']([a-z][a-z0-9_]{2,})["']/g)) {
        record(entry[1], file, "a TABLES map");
      }
    }
  }
  return found;
}

describe("every table the code declares is one a migration creates", () => {
  const created = tablesAfterReplay();
  const declared = declaredTables();

  it("parsed enough of the migrations and the runtime to mean something", () => {
    // Both halves can go blind independently, and either one silently turns
    // the assertion below into a comparison of two empty sets.
    assert.ok(created.size > 100, `only ${created.size} tables parsed from supabase/migrations; this check has gone blind`);
    assert.ok(declared.size > 50, `only ${declared.size} tables declared in the runtime; the scan is not finding them`);
  });

  it("finds the indirect declarations, not only the request URLs", () => {
    // The specific gap this file exists for. If the TABLES-map and helper-call
    // patterns stop matching, what is left is what tenant-isolation.test.js
    // already covers, and this file is a duplicate that reads like a second
    // opinion.
    const indirect = [...declared.values()].filter((where) => /TABLES map|safeCountTable|table:/.test(where));
    assert.ok(
      indirect.length > 10,
      `only ${indirect.length} tables found through indirection; the patterns that catch the product_modules case are not matching`
    );
  });

  it("names no table that no migration creates", () => {
    const missing = [...declared.entries()]
      .filter(([table]) => !created.has(table))
      .map(([table, where]) => `${table} <- ${where}`)
      .sort();

    assert.deepEqual(
      missing,
      [],
      "These names are used as tables and no migration creates them, so every query against " +
        "them fails and the feature behind them cannot work.\nEither add the migration, or " +
        "point the code at the table that already holds this data."
    );
  });
});
