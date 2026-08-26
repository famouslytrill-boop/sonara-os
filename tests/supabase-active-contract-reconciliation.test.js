"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const { DATABASE_TABLES } = require(path.join(root, "lib", "sonara-database-contract.cjs"));
const { RETIRED_DATABASE_TABLES } = require(path.join(root, "lib", "sonara-database-retirement-contract.cjs"));
const verifier = fs.readFileSync(path.join(root, "scripts", "verify-production-supabase.mjs"), "utf8");
const migration = fs.readFileSync(
  path.join(root, "supabase", "migrations", "20260727024500_service_role_extension_grants.sql"),
  "utf8"
);

const EXTENSION_TABLES = Object.freeze([
  "business_channels",
  "business_control_audit_events",
  "business_integration_connections",
  "business_ownership_transfers",
  "business_permission_grants",
  "creator_generation_assets",
  "creator_generation_events",
  "creator_generation_jobs",
  "creator_reference_analyses",
  "creator_voice_consents",
  "growth_audience_segments",
  "growth_contact_consents",
  "growth_content_queue",
  "growth_control_events",
  "growth_conversions",
  "growth_experiment_variants",
  "growth_metric_snapshots",
  "growth_provider_connections",
  "growth_provider_jobs",
  "growth_touchpoints",
  "product_lifecycle_events",
  "product_lifecycle_evidence",
  "product_lifecycle_feedback",
  "product_lifecycle_initiatives",
  "product_lifecycle_iterations",
  "product_lifecycle_requirements",
  "product_lifecycle_stage_reviews"
]);

function occurrences(source, value) {
  return source.split(value).length - 1;
}

describe("Supabase active contract reconciliation", () => {
  // The guard that would have caught four live tables sitting on the retired
  // list, where they had stopped being true and nothing was rechecking.
  //
  // Being listed as retired has a cost that reads as harmless: verify-production-supabase.mjs
  // drops the name from `expectedTables` and verifies it with `required: false`,
  // so production is not required to have it -- and the run emits a warning
  // saying the table "should be reviewed for archival". employee_announcements,
  // employee_tasks, quotes and reviews were all on it while /staff/announcements,
  // /staff/tasks, /business-builder/owner/quotes and the customer-journey funnel
  // read them.
  it("lists no table that live runtime code still queries", () => {
    // The four shapes scripts/verify-supabase-contract.mjs treats as a runtime
    // table reference, plus the two helper signatures used across routes/.
    // Comments are stripped first, because a table named in a comment is a table
    // discussed and not one queried -- the same rule report-orphan-tables.mjs uses.
    const INVENTORIES = new Set([
      "sonara-database-contract.cjs",
      "sonara-tenant-scoped-tables.cjs",
      "sonara-member-read-policies.cjs",
      "sonara-orphan-tables.cjs",
      "sonara-database-retirement-contract.cjs"
    ]);
    const strip = (text) => text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

    let source = strip(fs.readFileSync(path.join(root, "server.js"), "utf8"));
    for (const directory of ["routes", "lib"]) {
      for (const name of fs.readdirSync(path.join(root, directory))) {
        if (!name.endsWith(".cjs") || INVENTORIES.has(name)) continue;
        source += "\n" + strip(fs.readFileSync(path.join(root, directory, name), "utf8"));
      }
    }

    const referenced = new Set();
    for (const pattern of [
      /\/rest\/v1\/([a-z0-9_]+)/gi,
      /safeListTable\(\s*["']([a-z0-9_]+)["']/gi,
      /\btable\s*:\s*["']([a-z0-9_]+)["']/gi,
      /\brest\(\s*["']([a-z0-9_]+)["']/gi,
      /supabaseList\(\s*\w+\s*,\s*["']([a-z0-9_]+)["']/gi,
      /supabase(?:Insert|Patch|Count)\(\s*\w+\s*,\s*["']([a-z0-9_]+)["']/gi
    ]) {
      for (const match of source.matchAll(pattern)) referenced.add(match[1]);
    }

    // Without this the check passes by measuring nothing the day a helper is
    // renamed and every pattern stops matching.
    assert.ok(referenced.size >= 50, `only ${referenced.size} runtime table references found; this check has gone blind`);
    assert.ok(RETIRED_DATABASE_TABLES.length >= 10, "the retirement list has emptied; this check is asserting about nothing");

    const stillQueried = RETIRED_DATABASE_TABLES.filter((table) => referenced.has(table));
    assert.deepEqual(
      stillQueried,
      [],
      `these are listed as retired, so production is not required to have them and the verifier advises archiving them -- while live code queries them:\n  ${stillQueried.join("\n  ")}`
    );
  });

  it("keeps historical migration versions while excluding only reviewed retired identifiers from required presence", () => {
    // 27 until 18 August 2026, when employee_announcements, employee_tasks,
    // quotes and reviews came off it -- all four were queried by live code while
    // listed as retired, which made production not required to have them.
    assert.equal(RETIRED_DATABASE_TABLES.length, 23);
    assert.equal(new Set(RETIRED_DATABASE_TABLES).size, RETIRED_DATABASE_TABLES.length);
    for (const table of RETIRED_DATABASE_TABLES) assert.ok(!DATABASE_TABLES.includes(table), `${table} is still canonical`);
    assert.match(verifier, /RETIRED_DATABASE_TABLES/);
    assert.match(verifier, /migrationState\.tables\]\.filter\(\(table\) => !retiredTables\.has\(table\)\)/);
    assert.match(verifier, /local migration is not recorded as applied in production/);
    assert.match(verifier, /verifyTableState\(tableName, publicTables\.get\(tableName\), \{ required: true, classification: "active" \}\)/);
  });

  it("still enforces RLS, keys, indexes, and service access when a retired table remains deployed", () => {
    assert.match(verifier, /verifyTableState\(tableName, table, \{ required: false, classification: "retired" \}\)/);
    assert.match(verifier, /retired table has row-level security disabled/);
    assert.match(verifier, /retired table has no primary key/);
    assert.match(verifier, /retired table has an invalid or unready index/);
    assert.match(verifier, /service role cannot read retired table/);
    assert.match(verifier, /deployedRetiredTables/);
  });

  it("grants the service role CRUD access to every active extension table", () => {
    assert.equal(EXTENSION_TABLES.length, 27);
    for (const table of EXTENSION_TABLES) assert.equal(occurrences(migration, `'${table}'`), 1, `grant contract mismatch for ${table}`);
    assert.match(migration, /to_regclass\(format\('public\.%I', expected\.name\)\) is null/i);
    assert.match(migration, /raise exception 'SONARA extension grant reconciliation failed; missing tables:/i);
    assert.match(migration, /grant select, insert, update, delete on table public\.%I to service_role/i);
    assert.match(migration, /grant usage, select on all sequences in schema public to service_role/i);
    assert.match(migration, /notify pgrst, 'reload schema'/i);
    assert.doesNotMatch(migration, /grant\s+.*\s+to\s+(?:anon|authenticated)/i);
    assert.doesNotMatch(migration, /SUPABASE_SERVICE_ROLE_KEY|SUPABASE_DB_PASSWORD|eyJ[A-Za-z0-9_-]{20,}/i);
  });

  it("retains product lifecycle in the PostgREST connectivity proof", () => {
    assert.match(verifier, /"product_lifecycle_initiatives"/);
    assert.match(verifier, /PostgREST cannot reach public\.\$\{tableName\}/);
  });
});
