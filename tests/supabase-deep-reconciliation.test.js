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

  it("pushes migrations with --include-all, which a repair migration depends on", () => {
    // `--include-all` is what makes `supabase db push` apply a pending
    // migration whose version is older than one already in the repository.
    //
    // That is not a detail. Production stopped deploying on 5 August 2026 --
    // fourteen consecutive failed runs -- because
    // 20260811220000_customer_invoices_accounts_receivable.sql references
    // public.quotes and production does not have it. The fix is
    // 20260811210000_repair_missing_platform_tables.sql, versioned deliberately
    // *between* the last migration production applied and the one that fails,
    // so it runs first.
    //
    // Without this flag the CLI treats an out-of-order pending migration as
    // something to skip rather than apply, and the repair would be silently
    // left out while the deploy failed with the same error as before. Removing
    // the flag would look like tidying and would undo the fix.
    for (const command of [/supabase db push --linked --include-all --dry-run/, /supabase db push --linked --include-all --password/]) {
      assert.match(productionWorkflow, command, "supabase db push no longer passes --include-all");
    }
  });

  it("keeps the repair migration ahead of the one it unblocks", () => {
    // Ordering is the whole mechanism, and it is a filename, which is the
    // easiest thing in a repository to rename without thinking about it.
    const dir = path.join(__dirname, "..", "supabase", "migrations");
    const names = fs.readdirSync(dir).filter((name) => name.endsWith(".sql"));
    const repair = names.find((name) => name.includes("repair_missing_platform_tables"));
    const blocked = names.find((name) => name.includes("customer_invoices_accounts_receivable"));
    assert.ok(repair, "the repair migration is gone; production's deploy depends on it");
    assert.ok(blocked, "the migration the repair exists for is gone; the repair may no longer be needed");
    assert.ok(repair < blocked, `${repair} must sort before ${blocked} or db push applies them the wrong way round`);

    // And it must create the table the failure named, not merely exist.
    //
    // SQL comments are stripped before the negative check. The first version of
    // this asserted against the raw file and failed on the migration's own
    // comment explaining *why* it does not create billing_customers -- a
    // pattern loose enough to match prose, which is the second time that shape
    // has come up today. The positive checks read the raw text on purpose: a
    // `create table` line commented out is not a create table.
    const raw = fs.readFileSync(path.join(dir, repair), "utf8");
    const sql = raw.split("\n").map((line) => line.replace(/--.*$/, "")).join("\n");
    for (const table of ["public.customers", "public.quotes"]) {
      assert.ok(
        sql.includes(`create table if not exists ${table}`),
        `the repair no longer creates ${table} with if-not-exists; it must be a no-op where the table is already there`
      );
    }
    assert.ok(
      !sql.includes("billing_customers"),
      "the repair creates billing_customers, which 20260805120000_retire_superseded_tables.sql retired on purpose"
    );
    assert.match(raw, /billing_customers/, "the note explaining why billing_customers is excluded has gone");
  });

  it("registers a direct operator command", () => {
    assert.equal(packageJson.scripts["verify:production-supabase"], "node scripts/verify-production-supabase.mjs");
  });
});
