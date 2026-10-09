"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const generator = require("../scripts/generate-catalog-sync-migration.cjs");
const { chainCommands } = require("../lib/sonara-release-chain.cjs");

const root = path.join(__dirname, "..");
const migrationsDir = path.join(root, "supabase", "migrations");
const migrations = fs.readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort();

describe("the migrations are executed somewhere, not only read", () => {
  // Every other database check in this repository reads the migration files as
  // text. That is how a migration history no database would accept stayed green
  // through the whole release chain.
  it("has enough migrations to be measuring anything", () => {
    assert.ok(migrations.length >= 90, `only ${migrations.length} migrations found; these checks have gone blind`);
  });

  it("checks frozen migrations before either push and offers a read-only preview", () => {
    const scripts = require("../package.json").scripts;
    for (const name of ["db:preview", "db:push", "db:push:all"]) {
      assert.ok(scripts[name].indexOf("verify:applied-migrations") < scripts[name].indexOf("supabase db push"));
      assert.match(scripts[name], /pnpm run verify:applied-migrations && supabase db push/);
      assert.doesNotMatch(scripts[name], /db:patch-triggers/);
    }
    assert.match(scripts["db:preview"], /supabase db push --linked --dry-run/);
  });

  describe("the replay command", () => {
    const source = fs.readFileSync(path.join(root, "scripts", "verify-migration-replay.mjs"), "utf8");

    it("is in the release chain", () => {
      const scripts = require("../package.json").scripts;
      assert.ok(scripts["verify:migration-replay"], "the command is not declared");
      // Chain membership is asked of lib/sonara-release-chain.cjs, not of the string.
    //
    // `verify:launch` used to be one flat line, so matching it for a command
    // name worked. Everything after `verify:db` now sits in `verify:gates` so
    // CI can run the whole gate in one step, and five checks reported commands
    // as missing from a chain that runs them -- accurate about the string,
    // wrong about the thing they named.
      assert.ok(chainCommands(scripts).includes("verify:migration-replay"), "the command is not in the release chain");
    });

    // A check whose skip path is the one that always runs is not a check.
    it("cannot skip in CI", () => {
      const workflow = fs.readFileSync(path.join(root, ".github", "workflows", "sonara-industries-ci.yml"), "utf8");
      assert.match(workflow, /verify:migration-replay/, "CI does not run the replay");
      assert.match(workflow, /SONARA_MIGRATION_REPLAY_REQUIRED: "1"/, "CI does not make a missing database a failure");
      assert.match(source, /SONARA_MIGRATION_REPLAY_REQUIRED === "1"/, "the script does not read the variable CI sets");
    });

    it("has a supported non-root replay lane with preserved candidate evidence", () => {
      const lane = fs.readFileSync(path.join(root, ".github", "workflows", "native-migration-replay.yml"), "utf8");
      assert.match(lane, /runs-on: ubuntu-24\.04/);
      assert.match(lane, /SONARA_MIGRATION_REPLAY_REQUIRED: "1"/);
      assert.match(lane, /set -euo pipefail/);
      assert.match(lane, /node scripts\/verify-migration-replay\.mjs/);
      assert.match(lane, /git rev-parse HEAD/);
      assert.match(lane, /sha256sum supabase\/migrations\/\*\.sql/);
      assert.match(lane, /if: always\(\)/);
      assert.match(lane, /Native replay requires a non-root runner/);
      assert.match(lane, /node: \[22, 24, 26\]/);
      assert.match(lane, /postgres: \[16, 17, 18\]/);
      assert.match(lane, /--postgres-bin "\$POSTGRES_BIN"/);
      assert.match(lane, /node --version > replay-evidence\/node-version\.txt/);
      assert.match(lane, /postgres-\$\{\{ matrix\.postgres \}\}/);
    });

    it("executes the disposable-only cohort RLS probe and demands a real proof marker", () => {
      const relative = "tests/sql/p0-cohort-reader-rls-snapshot.sql";
      const fixture = fs.readFileSync(path.join(root, relative), "utf8");
      const has = (haystack, needle) =>
        assert.ok(haystack.includes(needle), `Missing native replay proof contract: ${needle}`);

      has(source, "p0-cohort-reader-rls-snapshot.sql");
      has(source, "p0_cohort_reader_rls_snapshot_passed");
      has(fixture, "current_database() <> 'replay'");
      has(fixture, "inet_server_addr() IS NOT NULL");
      has(fixture, "CREATE ROLE sonara_cohort_reader LOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT");
      has(fixture, "SET SESSION AUTHORIZATION sonara_cohort_reader");
      has(fixture, "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
      has(fixture, "row_security_active('public.activity_events'::regclass)");
      has(fixture, "row_security_active('public.organizations'::regclass)");
      has(fixture, "RAISE EXCEPTION 'cohort roster predicate exposed or lost tenant rows'");
      // Mutation probe MUST demonstrate that a permissive PUBLIC policy would
      // expose tenant B, then roll it back instead of weakening the real gate.
      has(fixture, "CREATE POLICY sonara_cohort_fixture_mutant_public");
      has(fixture, "CREATE POLICY sonara_cohort_fixture_mutant_events");
      has(fixture, "cohort negative RLS guard not sensitive to a permissive policy leak");
      has(fixture, "RESET SESSION AUTHORIZATION");
      has(fixture, "DROP ROLE sonara_cohort_reader");
    });

    it("says loudly when it did not run, rather than reporting a pass", () => {
      assert.match(source, /MIGRATIONS WERE NOT REPLAYED IN THIS RUN/);
      assert.match(source, /Migration replay SKIPPED/);
    });

    it("refuses to report on a directory that has gone empty", () => {
      assert.match(source, /MINIMUM_MIGRATIONS/);
      assert.match(source, /this check has gone blind/i);
    });

    // Passing with no errors on a cluster where nothing happened is the exact
    // failure shape this repository keeps finding.
    it("proves the replay built a schema rather than doing nothing", () => {
      assert.match(source, /MUST_EXIST/);
      const listed = source.match(/const MUST_EXIST = \[([^\]]+)\]/);
      assert.ok(listed, "MUST_EXIST has moved; this check has gone blind");
      assert.ok(listed[1].split(",").length >= 3, "too few tables checked to prove anything");
    });

    describe("the Supabase shim", () => {
      const block = source.slice(source.indexOf("const SHIM = ["), source.indexOf("const required ="));

      it("was found, so the checks below are reading something", () => {
        assert.ok(block.length > 500, "the shim block has moved; these checks have gone blind");
      });

      // The rule that keeps the replay honest: the moment the shim creates
      // something of ours to get a migration past, the check has stopped
      // measuring the migrations.
      it("creates nothing in the public schema", () => {
        assert.doesNotMatch(block, /create\s+(table|view|function|type)\s+(if\s+not\s+exists\s+)?public\./i);
        assert.doesNotMatch(block, /insert\s+into\s+public\./i);
      });

      it("only supplies schemas a hosted Supabase project supplies", () => {
        const schemas = [...block.matchAll(/create schema if not exists (\w+)/g)].map((match) => match[1]);
        assert.ok(schemas.length >= 2, "no schemas parsed out of the shim; this check has gone blind");
        for (const schema of schemas) {
          assert.ok(["auth", "storage", "extensions", "graphql", "realtime"].includes(schema), `the shim creates ${schema}, which Supabase does not provide`);
        }
      });

      it("prints what it faked, so it is visible in the output", () => {
        assert.match(source, /Shim applied \(Supabase primitives only, nothing in public\)/);
      });
    });
  });
});

describe("an assertion about the catalog runs after the catalog exists", () => {
  // The bug: the completeness assertion was generated from today's catalog and
  // written into a migration dated 12 August, while nineteen of those products
  // are first inserted on 18 August. Production never re-runs an old migration,
  // so only a fresh replay ever saw it -- which is what every Supabase preview
  // branch is.
  const assertionFile = generator.assertionMigrationName;

  it("is generated into its own migration, dated last", () => {
    assert.ok(assertionFile, "the generator no longer names an assertion migration");
    assert.ok(migrations.includes(assertionFile), `${assertionFile} is not on disk`);
    const inserting = migrations.filter((name) =>
      /insert\s+into\s+(public\.)?service_catalog_items/i.test(fs.readFileSync(path.join(migrationsDir, name), "utf8"))
    );
    assert.ok(inserting.length >= 3, `only ${inserting.length} catalog-inserting migrations found; this check has gone blind`);
    for (const name of inserting) {
      assert.ok(name < assertionFile, `${name} inserts catalog rows after ${assertionFile}, so the assertion runs too early`);
    }
  });

  it("is not still sitting in the retirement migration", () => {
    const retirement = fs.readFileSync(path.join(migrationsDir, generator.migrationName), "utf8");
    assert.doesNotMatch(retirement, /have no active published row/, "the completeness assertion is back where it cannot pass");
    assert.doesNotMatch(retirement, /a retired public name survives/, "the retired-name assertion is back where it only sees half the rows");
  });

  it("still asserts every product in the catalog, not a subset", () => {
    const { RECOMMENDED_PRODUCT_CATALOG } = require("../lib/sonara-recommended-product-catalog.cjs");
    const body = fs.readFileSync(path.join(migrationsDir, assertionFile), "utf8");
    assert.ok(RECOMMENDED_PRODUCT_CATALOG.length >= 20, "the catalog has gone small; this check has gone blind");
    for (const item of RECOMMENDED_PRODUCT_CATALOG) {
      assert.ok(body.includes(`('${item.serviceKey}')`), `${item.serviceKey} is no longer asserted`);
    }
  });

  it("keeps the retirement and the sync where they happened", () => {
    const retirement = fs.readFileSync(path.join(migrationsDir, generator.migrationName), "utf8");
    assert.match(retirement, /set status = 'retired'/, "the retirement moved; it describes what changed on 12 August and belongs there");
    assert.match(retirement, /update public\.service_catalog_items as target/);
  });

  it("has a guard that fails if a catalog migration is ever added after it", () => {
    assert.equal(typeof generator.catalogInsertingMigrationsAfterAssertions, "function");
    assert.deepEqual(generator.catalogInsertingMigrationsAfterAssertions(), []);
  });
});
