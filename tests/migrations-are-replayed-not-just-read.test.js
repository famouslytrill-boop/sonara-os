"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const generator = require("../scripts/generate-catalog-sync-migration.cjs");

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

  describe("the replay command", () => {
    const source = fs.readFileSync(path.join(root, "scripts", "verify-migration-replay.mjs"), "utf8");

    it("is in the release chain", () => {
      const scripts = require("../package.json").scripts;
      assert.ok(scripts["verify:migration-replay"], "the command is not declared");
      assert.match(scripts["verify:launch"], /verify:migration-replay/, "the command is not in verify:launch");
    });

    // A check whose skip path is the one that always runs is not a check.
    it("cannot skip in CI", () => {
      const workflow = fs.readFileSync(path.join(root, ".github", "workflows", "sonara-industries-ci.yml"), "utf8");
      assert.match(workflow, /verify:migration-replay/, "CI does not run the replay");
      assert.match(workflow, /SONARA_MIGRATION_REPLAY_REQUIRED: "1"/, "CI does not make a missing database a failure");
      assert.match(source, /SONARA_MIGRATION_REPLAY_REQUIRED === "1"/, "the script does not read the variable CI sets");
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
