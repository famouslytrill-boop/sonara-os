"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const migration = fs.readFileSync(path.join(
  root,
  "supabase/migrations/20260726232000_deep_database_reconciliation.sql"
), "utf8");
const verifier = fs.readFileSync(path.join(root, "scripts/verify-production-supabase.mjs"), "utf8");
const productionWorkflow = fs.readFileSync(path.join(root, ".github/workflows/controlled-production-deploy.yml"), "utf8");
const ciWorkflow = fs.readFileSync(path.join(root, ".github/workflows/sonara-industries-ci.yml"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

describe("Supabase deep database reconciliation", () => {
  it("creates a service-role-only metadata snapshot with deep structural checks", () => {
    assert.match(migration, /create or replace function public\.sonara_database_deep_snapshot\(\)/i);
    assert.match(migration, /security definer/i);
    assert.match(migration, /set search_path = ''/i);
    assert.match(migration, /pg_catalog\.pg_policy/i);
    assert.match(migration, /pg_catalog\.pg_constraint/i);
    assert.match(migration, /pg_catalog\.pg_index/i);
    assert.match(migration, /pg_catalog\.pg_trigger/i);
    assert.match(migration, /storage\.buckets/i);
    assert.match(migration, /supabase_migrations\.schema_migrations/i);
    assert.match(migration, /revoke execute on function public\.sonara_database_deep_snapshot\(\) from public, anon, authenticated/i);
    assert.match(migration, /grant execute on function public\.sonara_database_deep_snapshot\(\) to service_role/i);
    assert.doesNotMatch(migration, /SUPABASE_SERVICE_ROLE_KEY|SUPABASE_DB_PASSWORD|hf_[A-Za-z0-9]{10,}/i);
  });

  it("derives the production table and migration inventory from the migration files", () => {
    assert.match(verifier, /deriveMigrationState\(\)/);
    assert.match(verifier, /create\\s\+table/);
    assert.match(verifier, /drop\\s\+table/);
    assert.match(verifier, /applied_migrations/);
    assert.match(verifier, /row-level security is disabled/);
    assert.match(verifier, /table has no primary key/);
    assert.match(verifier, /invalid or unready index/);
    assert.match(verifier, /required storage bucket is public/);
    assert.match(verifier, /PostgREST connectivity/);
    assert.doesNotMatch(verifier, /console\.(?:log|error|warn)\([^\n]*(?:serviceRoleKey|SUPABASE_SERVICE_ROLE_KEY)/);
  });

  it("persists safe production verification diagnostics for failed deployment artifacts", () => {
    assert.match(verifier, /release-validation\.log/);
    assert.match(verifier, /function persistDiagnostics\(summary\)/);
    assert.match(verifier, /fs\.appendFileSync\(diagnosticLogPath/);
    assert.match(verifier, /FAILURE: \$\{failure\}/);
    assert.doesNotMatch(verifier, /appendFileSync\([^\n]*(?:serviceRoleKey|SUPABASE_SERVICE_ROLE_KEY)/);
  });

  it("previews linked migrations in pull-request CI", () => {
    assert.match(ciWorkflow, /supabase link --project-ref/);
    assert.match(ciWorkflow, /supabase db push --linked --include-all --dry-run/);
    assert.match(ciWorkflow, /supabase migration list --linked/);
  });

  it("applies migrations and verifies the complete production database before deploying", () => {
    const applyPosition = productionWorkflow.indexOf("Apply production database migrations");
    const verifyPosition = productionWorkflow.indexOf("Verify complete production Supabase state");
    const deployPosition = productionWorkflow.indexOf("Deploy validated source to Vercel production");
    assert.ok(applyPosition >= 0);
    assert.ok(verifyPosition > applyPosition);
    assert.ok(deployPosition > verifyPosition);
    assert.match(productionWorkflow, /node --env-file=\.env\.production\.catalog-verification scripts\/verify-production-supabase\.mjs/);
    assert.match(productionWorkflow, /SUPABASE_SERVICE_ROLE_KEY: \$\{\{ secrets\.SUPABASE_SERVICE_ROLE_KEY \}\}/);
  });

  it("registers a direct operator command", () => {
    assert.equal(packageJson.scripts["verify:production-supabase"], "node scripts/verify-production-supabase.mjs");
  });
});
