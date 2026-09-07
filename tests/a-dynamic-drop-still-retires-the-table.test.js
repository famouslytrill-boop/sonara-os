"use strict";

// A migration that drops a table through dynamic SQL, and a parser that cannot
// see it.
//
// Deployment #130 failed at "Verify complete production Supabase state" with
// `active application table is missing from production: public.sonara_subscriptions`,
// plus two more like it. The production gate was demanding tables the codebase
// had deliberately dropped a month earlier.
//
// `deriveMigrationState` in scripts/verify-production-supabase.mjs builds the
// expected-table set from a regex over literal statements:
//
//     create table [if not exists] public.<name>   -- adds
//     drop   table [if exists]     public.<name>   -- removes
//
// `20260806000000_drop_retired_superseded_tables.sql` drops thirteen tables
// inside a loop, through `execute format('drop table ... public.%I', t)`. The
// name is `%I` at parse time, so no literal ever appears and the removal half
// never fires. The creates were counted; the drops were invisible.
//
// The fix was to add all thirteen to RETIRED_DATABASE_TABLES, which is the list
// that means "production is not required to have this table". This is the other
// half: the migration's own array is the authority on what it retires, so a name
// in it that is missing from the contract fails here rather than in a deploy.
//
// Deliberately NOT solved by teaching the parser to read dynamic SQL. A regex
// that tries to follow `format()` through a loop is a parser with its own silent
// failure mode, which is the thing being fixed. Reading the array the migration
// actually iterates is a fact; inferring intent from generated SQL is a guess.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { RETIRED_DATABASE_TABLES } = require("../lib/sonara-database-retirement-contract.cjs");
const { DATABASE_TABLES } = require("../lib/sonara-database-contract.cjs");

const root = path.join(__dirname, "..");
const migrationsDir = path.join(root, "supabase", "migrations");

// Migrations that drop tables by iterating an array of names. Each entry names
// the file and the declared array to read.
//
// A register rather than a sweep: a sweep for "any array of quoted strings in a
// migration" matches seed data, enum values and column lists, and a check that
// matches everything is one somebody deletes.
const DYNAMIC_DROP_MIGRATIONS = [
  {
    file: "20260806000000_drop_retired_superseded_tables.sql",
    declaration: "superseded constant text[] := array["
  }
];

function namesDroppedBy({ file, declaration }) {
  const source = fs.readFileSync(path.join(migrationsDir, file), "utf8");
  const start = source.indexOf(declaration);
  assert.notEqual(start, -1, `${file} no longer declares \`${declaration}\`; this check has gone blind`);
  const end = source.indexOf("];", start);
  assert.notEqual(end, -1, `${file}: the array beginning at \`${declaration}\` is never closed`);
  const block = source.slice(start + declaration.length, end);
  return [...block.matchAll(/'([a-z0-9_]+)'/g)].map((match) => match[1]);
}

// What the production gate's own parser believes the migrations leave behind.
// Copied from scripts/verify-production-supabase.mjs deliberately: the point is
// to demonstrate what that regex does and does not see, so it has to be that
// regex rather than a call into it.
function tablesTheParserSees() {
  const tables = new Set();
  for (const file of fs.readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort()) {
    const source = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    for (const event of source.matchAll(
      /\b(create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z0-9_]+)|drop\s+table\s+(?:if\s+exists\s+)?public\.([a-z0-9_]+))/gi
    )) {
      if (event[2]) tables.add(event[2].toLowerCase());
      if (event[3]) tables.delete(event[3].toLowerCase());
    }
  }
  return tables;
}

describe("a table dropped through dynamic SQL is still retired", () => {
  const dropped = DYNAMIC_DROP_MIGRATIONS.flatMap(namesDroppedBy);

  it("reads real names out of the migration, rather than an empty array", () => {
    assert.ok(DYNAMIC_DROP_MIGRATIONS.length >= 1, "no dynamic-drop migrations registered; this check has gone blind");
    assert.ok(dropped.length >= 10, `only ${dropped.length} dropped table names parsed; this check has gone blind`);
    for (const name of dropped) {
      assert.match(name, /^[a-z][a-z0-9_]*$/, `${name} does not look like a table name; the array parse has drifted`);
    }
  });

  it("retires every name the migration drops", () => {
    const contract = new Set(RETIRED_DATABASE_TABLES);
    const missing = dropped.filter((name) => !contract.has(name));
    assert.deepEqual(
      missing,
      [],
      "these tables are dropped by a migration and are not in RETIRED_DATABASE_TABLES, so the production gate " +
        `demands tables the codebase deleted:\n  ${missing.join("\n  ")}\n\n` +
        "That is what failed deployment #130. Add them to lib/sonara-database-retirement-contract.cjs."
    );
  });

  it("does not retire a table the runtime contract still calls active", () => {
    // The opposite mistake, and the more dangerous one: a table both dropped and
    // required would mean the product queries something no migration leaves
    // behind. Neither list may contain a name the other does.
    const active = new Set(DATABASE_TABLES);
    const contradictions = dropped.filter((name) => active.has(name));
    assert.deepEqual(
      contradictions,
      [],
      `these tables are dropped by a migration and still listed as active runtime tables: ${contradictions.join(", ")}`
    );
  });

  it("shows the parser really cannot see these drops, which is why this file exists", () => {
    // If this ever fails, the gate's regex learned to read dynamic drops and
    // this whole check became unnecessary rather than wrong. Delete it then --
    // but find out first, because the likelier cause is that the migration was
    // rewritten to use literal statements and some OTHER migration now hides
    // its drops the old way.
    const seen = tablesTheParserSees();
    const invisible = dropped.filter((name) => seen.has(name));
    assert.ok(
      invisible.length >= 1,
      "the production gate's parser now removes every dynamically dropped table by itself. " +
        "Confirm that before deleting this check: it is likelier that this migration changed than that the regex learned."
    );
  });
});
