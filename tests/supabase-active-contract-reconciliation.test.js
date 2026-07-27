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
  it("keeps historical migration versions while excluding only reviewed retired identifiers from required presence", () => {
    assert.equal(RETIRED_DATABASE_TABLES.length, 27);
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
    assert.match(verifier, /service role cannot read \$\{classification\} table/);
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
