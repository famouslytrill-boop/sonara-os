"use strict";

// The migration history has to be able to rebuild the database.
//
// It could not. Two separate defects, both invisible to every check in this
// repository and to production:
//
//   sonara_control_plane_checks was created without row level security, while a
//   later migration's preflight requires every contract table to have it.
//
//   integration_providers was created with check (status in
//   ('active','inactive','manual_review')), while a later migration inserts
//   'disabled' rows for unverified external sources.
//
// Production has neither problem. It was built one migration at a time and both
// objects were widened out of band, so the live database and the migration
// history had quietly diverged -- and the history was the wrong one. The only
// thing that replays the history from empty is a Supabase preview branch, and
// none had been created for weeks while the project sat at its concurrent
// branch limit.
//
// Finding them one at a time, one preview-branch run per push, is a slow way to
// learn how many there are. This reads the migrations directly and answers it
// in one pass.
//
// It is deliberately narrow. It understands the common
// `check (col in ('a','b'))` shape and literal inserts, which is what both
// defects looked like. It does not attempt to interpret SQL generally, and a
// value it cannot resolve is skipped rather than guessed at -- a check that
// invents findings gets switched off, and then catches nothing.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const migrationsDir = path.join(__dirname, "..", "supabase", "migrations");

function migrationFiles() {
  return fs
    .readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => ({ name, sql: fs.readFileSync(path.join(migrationsDir, name), "utf8") }));
}

// Strip comments so a value mentioned in prose is not read as SQL. Both fixes
// above added long comments naming the very values they allow.
function withoutComments(sql) {
  return sql.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

// table.column -> Set of allowed literals, from `check (col in ('a','b'))`
// written inside a create table.
function allowedValues(files) {
  const allowed = new Map();
  for (const { sql } of files) {
    const clean = withoutComments(sql);
    for (const table of clean.matchAll(/create table if not exists public\.([a-z_]+)\s*\(([\s\S]*?)\n\);/g)) {
      const tableName = table[1];
      for (const column of table[2].matchAll(/^\s*([a-z_]+)\s+[a-z]+[^,\n]*?check\s*\(\s*\1\s+in\s*\(([^)]*)\)\s*\)/gim)) {
        const values = [...column[2].matchAll(/'([^']*)'/g)].map((match) => match[1]);
        if (values.length) allowed.set(`${tableName}.${column[1]}`, new Set(values));
      }
    }
  }
  return allowed;
}

// Literal inserts, as `insert into public.t (a, b) values ('x', 'y'), (...)`.
// Rows containing anything that is not a plain string literal, a number, null
// or a cast are skipped: resolving those needs a SQL engine.
function insertedValues(files) {
  const inserted = [];
  for (const { name, sql } of files) {
    const clean = withoutComments(sql);
    for (const statement of clean.matchAll(/insert\s+into\s+public\.([a-z_]+)\s*\(([^)]*)\)\s*values([\s\S]*?)(?:on\s+conflict|;)/gi)) {
      const table = statement[1];
      const columns = statement[2].split(",").map((column) => column.trim());
      for (const row of statement[3].matchAll(/\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g)) {
        const cells = splitCells(row[1]);
        if (cells.length !== columns.length) continue;
        cells.forEach((cell, index) => {
          const literal = /^'((?:[^']|'')*)'(?:::[a-z]+)?$/i.exec(cell.trim());
          if (literal) inserted.push({ file: name, key: `${table}.${columns[index]}`, value: literal[1].replace(/''/g, "'") });
        });
      }
    }
  }
  return inserted;
}

// Split on commas that are not inside quotes or parentheses.
function splitCells(row) {
  const cells = [];
  let current = "";
  let quoted = false;
  let depth = 0;
  for (let index = 0; index < row.length; index += 1) {
    const character = row[index];
    if (character === "'" && row[index - 1] !== "\\") quoted = !quoted;
    if (!quoted && character === "(") depth += 1;
    if (!quoted && character === ")") depth -= 1;
    if (!quoted && depth === 0 && character === ",") {
      cells.push(current);
      current = "";
      continue;
    }
    current += character;
  }
  if (current.trim()) cells.push(current);
  return cells;
}

describe("the migration history can rebuild the database", () => {
  let files;

  before(() => {
    files = migrationFiles();
  });

  it("reads enough migrations for the check to mean something", () => {
    assert.ok(files.length >= 60, `only ${files.length} migrations read; the scan is not covering the history`);
    const allowed = allowedValues(files);
    assert.ok(allowed.size >= 40, `only ${allowed.size} value constraints parsed; the parser has gone blind`);
  });

  it("never inserts a value its own check constraint forbids", () => {
    const allowed = allowedValues(files);
    const offenders = [];
    for (const { file, key, value } of insertedValues(files)) {
      const permitted = allowed.get(key);
      if (!permitted) continue;
      if (!permitted.has(value)) {
        offenders.push(`${file}: ${key} = '${value}' (allowed: ${[...permitted].sort().join(", ")})`);
      }
    }
    assert.deepEqual(
      offenders,
      [],
      `These migrations insert values their own constraint rejects, so replaying the history from empty fails:\n  ${offenders.join("\n  ")}\n\n` +
        "Production may accept them because the constraint was widened by hand. Widen it in the migration that creates the table instead."
    );
  });

  it("enables row level security on every table the ecosystem contract requires", () => {
    // 20260722170000 raises if a contract table has no RLS. It reads the live
    // database, so it only fails on a replay -- by which point it is a failed
    // deployment rather than a failed test.
    const contract = files.find((file) => file.name.startsWith("20260722170000"));
    assert.ok(contract, "the ecosystem contract migration is missing");
    const list = /contract_tables constant text\[\] := array\[([\s\S]*?)\];/.exec(contract.sql);
    assert.ok(list, "could not read the contract table list; this check has gone blind");
    const required = [...list[1].matchAll(/'([a-z_]+)'/g)].map((match) => match[1]);
    assert.ok(required.length >= 100, `only ${required.length} contract tables parsed`);

    const everySql = withoutComments(files.map((file) => file.sql).join("\n"));
    const created = new Set([...everySql.matchAll(/create table if not exists public\.([a-z_]+)/g)].map((match) => match[1]));
    const rlsEnabled = new Set(
      [...everySql.matchAll(/alter table (?:if exists )?public\.([a-z_]+)\s+enable row level security/g)].map((match) => match[1])
    );

    const missing = required.filter((table) => created.has(table) && !rlsEnabled.has(table));
    assert.deepEqual(
      missing,
      [],
      `These tables are in the ecosystem contract and never have row level security enabled in the migrations:\n  ${missing.join("\n  ")}\n\n` +
        "The contract preflight raises on them when the history is replayed from empty."
    );
  });
});
