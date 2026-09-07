"use strict";

// A table created after the Data API hardening, with nobody declared on it.
//
// 20260718064853_data_api_privilege_hardening made new public objects opt-in:
//
//     alter default privileges for role postgres in schema public
//       revoke select, insert, update, delete on tables from anon, authenticated, service_role;
//
// and said why, in its own words: "Existing objects retain their current
// explicit/legacy grants. New public objects become opt-in so a future
// migration must declare its Data API surface alongside RLS."
//
// The boundary works. The declaration is what keeps getting forgotten, and it
// is invisible until a deployment reaches production and reports:
//
//     service role cannot read table: public.user_auth_factors
//
// That has happened twice. On 27 July for public.sonara_auth_rate_limits, fixed
// one table at a time by 20260727190000. And again in deployment #131, which
// named five -- two of them the tables lib/sonara-two-factor.cjs reads on every
// sign-in that checks for a second factor. A table the service role cannot
// select from is a feature that does not work in production.
//
// So the rule is checked here, offline, where it costs a test run rather than a
// deploy: a migration dated after the hardening that creates a table must also
// grant that table to service_role, somewhere in the migration set.
//
// This deliberately does NOT check production. It cannot -- the release gate
// needs credentials and does that job. What it checks is the declaration, which
// is the thing a person forgets to write.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { RETIRED_DATABASE_TABLES } = require("../lib/sonara-database-retirement-contract.cjs");

const root = path.join(__dirname, "..");
const migrationsDir = path.join(root, "supabase", "migrations");

// The migration that made new objects opt-in. Everything below is relative to it.
const HARDENING_VERSION = "20260718064853";
const HARDENING_FILE = "20260718064853_data_api_privilege_hardening.sql";
const DECLARATION_FILE = "20260907120000_declare_service_role_data_api_surface.sql";

// The literal a loop-grant migration executes. Migrations that grant a list of
// tables build the statement with format(); this is the shape they build.
const LOOP_GRANT = /grant[^']*on table public\.%I[^']*to service_role/i;

function migrationFiles() {
  return fs.readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort();
}

function versionOf(fileName) {
  return fileName.match(/^([0-9]+)_/)?.[1] ?? "0";
}

// Every table named by a `grant ... on public.<name> ... to service_role`,
// whether written out directly or iterated from a declared array.
function tablesDeclaredToServiceRole() {
  const declared = new Set();
  for (const file of migrationFiles()) {
    const source = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    for (const match of source.matchAll(
      /grant[^;]*?\bon\s+(?:table\s+)?public\.([a-z0-9_]+)[^;]*?to[^;]*?service_role/gi
    )) {
      declared.add(match[1].toLowerCase());
    }
    // A migration that grants through a loop declares its tables in an array.
    // Only read arrays out of files that actually contain the loop, so a list
    // of names for some unrelated purpose is not mistaken for a grant.
    if (LOOP_GRANT.test(source)) {
      for (const block of source.matchAll(/constant text\[\]\s*:=\s*ARRAY\[([\s\S]*?)\]/gi)) {
        for (const name of block[1].matchAll(/'([a-z0-9_]+)'/g)) declared.add(name[1]);
      }
    }
  }
  return declared;
}

// Every table a post-hardening migration can create. `create table if not
// exists` counts: whether it really creates the table depends on production
// state this repository cannot see, so a table it *might* create is a table
// that might land undeclared.
function tablesCreatedAfterHardening() {
  const created = new Map();
  for (const file of migrationFiles()) {
    if (versionOf(file) <= HARDENING_VERSION) continue;
    const source = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    for (const match of source.matchAll(/\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z0-9_]+)/gi)) {
      const name = match[1].toLowerCase();
      if (!created.has(name)) created.set(name, file);
    }
  }
  return created;
}

describe("a table created after the Data API hardening declares its surface", () => {
  const created = tablesCreatedAfterHardening();
  const declared = tablesDeclaredToServiceRole();

  it("still has a hardening migration to be relative to", () => {
    // Without the revoke, new tables inherit grants again and this whole check
    // is measuring a rule that no longer exists -- green, and meaningless.
    const source = fs.readFileSync(path.join(migrationsDir, HARDENING_FILE), "utf8");
    assert.match(
      source,
      /alter default privileges[\s\S]*?revoke select, insert, update, delete on tables from[^;]*service_role/i,
      `${HARDENING_FILE} no longer revokes default table privileges from service_role. ` +
        "If that was deliberate, this check is obsolete; if it was not, new tables are silently inheriting grants."
    );
  });

  it("read real migrations, rather than an empty directory", () => {
    assert.ok(created.size >= 100, `only ${created.size} post-hardening table creations found; this check has gone blind`);
    assert.ok(declared.size >= 100, `only ${declared.size} service_role grants parsed; the grant parse has drifted`);
  });

  it("grants every post-hardening table to the service role", () => {
    const undeclared = [...created.keys()].filter((name) => !declared.has(name)).sort();
    assert.deepEqual(
      undeclared,
      [],
      "these tables can be created by a migration dated after the Data API hardening and are never granted " +
        `to service_role, so the server cannot read them once they land:\n  ${undeclared
          .map((name) => `${name}  (${created.get(name)})`)
          .join("\n  ")}\n\n` +
        "Declare the surface in a migration, the way 20260727190000 and 20260907120000 do."
    );
  });

  it("pins the five tables deployment #131 actually named", () => {
    // The general rule above would pass if somebody narrowed the parse until it
    // matched nothing. These five failed a real deployment, so they are named
    // here and stay named.
    for (const table of ["shared_links", "user_auth_factors", "user_recovery_codes", "audio_assets", "daw_sessions"]) {
      assert.ok(
        declared.has(table),
        `public.${table} lost its service_role grant. That is the exact failure deployment #131 reported.`
      );
    }
  });

  it("keeps the retired half of the new declaration justified", () => {
    // Two of the five are retired, and they are granted only where they still
    // exist -- the `to_regclass ... IS NOT NULL` guard -- because production is
    // not required to have them. Asserted against that migration's own array
    // rather than against every grant in history: `integration_statuses` was
    // granted long before 20260806000000 dropped it, which is honest history and
    // not a fault, and a check that swept all of it would be measuring the wrong
    // population.
    const source = fs.readFileSync(path.join(migrationsDir, DECLARATION_FILE), "utf8");
    const block = source.match(/undeclared_retired constant text\[\]\s*:=\s*ARRAY\[([\s\S]*?)\]/i);
    assert.ok(block, `${DECLARATION_FILE} no longer declares undeclared_retired; this check has gone blind`);
    const names = [...block[1].matchAll(/'([a-z0-9_]+)'/g)].map((match) => match[1]).sort();
    assert.deepEqual(names, ["audio_assets", "daw_sessions"], "the retired half of the declaration changed");

    const retired = new Set(RETIRED_DATABASE_TABLES);
    for (const name of names) {
      assert.ok(retired.has(name), `${name} is granted as a retired table but is not in RETIRED_DATABASE_TABLES`);
    }
    assert.match(
      source,
      /IF to_regclass\(format\('public\.%I', table_name\)\) IS NOT NULL THEN/,
      "the retired grants lost their presence guard, so the migration will fail on a database that dropped them"
    );
  });
});
