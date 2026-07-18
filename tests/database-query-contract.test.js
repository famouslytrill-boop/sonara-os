const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const serverPath = path.join(root, "server.js");
const applyScriptPath = path.join(root, "scripts", "apply-database-query-contract.cjs");
const migrationPath = path.join(
  root,
  "supabase",
  "migrations",
  "20260718193000_operational_query_index_contract.sql"
);

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

describe("database query contract", () => {
  it("applies idempotently", function() {
    execFileSync(process.execPath, [applyScriptPath], { cwd: root, stdio: "pipe" });
    execFileSync(process.execPath, [applyScriptPath], { cwd: root, stdio: "pipe" });
  });

  it("uses deterministic membership resolution", function() {
    const source = read(serverPath);
    assert.match(
      source,
      /organization_memberships\?select=organization_id&user_id=eq\.\$\{encodeURIComponent\(userId\)\}&status=eq\.active&order=created_at\.asc\.nullslast,organization_id\.asc&limit=1/
    );
    assert.match(
      source,
      /business_memberships\?select=organization_id&user_id=eq\.\$\{encodeURIComponent\(userId\)\}&status=eq\.active&order=created_at\.asc\.nullslast,organization_id\.asc&limit=1/
    );
    assert.match(source, /"order=created_at\.asc\.nullslast,workspace_id\.asc"/);
  });

  it("pushes paid-access filtering into PostgREST", function() {
    const source = read(serverPath);
    assert.match(source, /if \(!allowedKeys\.length\)/);
    assert.match(source, /reason: "product_entitlement_unmapped"/);
    assert.match(
      source,
      /billing_entitlements\?select=entitlement_key,status&organization_id=eq\.\$\{encodeURIComponent\(organization\.organizationId\)\}&status=eq\.active&entitlement_key=in\.\(\$\{entitlementFilter\}\)&limit=1/
    );
    assert.match(
      source,
      /billing_subscriptions\?select=plan_slug,status&organization_id=eq\.\$\{encodeURIComponent\(organization\.organizationId\)\}&status=in\.\(active,trialing\)&plan_slug=in\.\(\$\{entitlementFilter\}\)&limit=1/
    );
    assert.doesNotMatch(
      source,
      /billing_subscriptions\?select=plan_slug,status&organization_id=eq\.\$\{encodeURIComponent\(organization\.organizationId\)\}`/
    );
  });

  it("reconciles the live billing subscription shape additively", function() {
    const sql = read(migrationPath);
    for (const column of [
      "organization_id",
      "provider",
      "provider_customer_ref",
      "provider_subscription_ref",
      "plan_slug",
      "status",
      "current_period_end",
      "cancel_at_period_end",
      "metadata",
      "created_at",
      "updated_at"
    ]) {
      assert.match(sql, new RegExp(`add column if not exists ${column}\\b`, "i"), `${column} must be reconciled additively`);
      assert.match(sql, new RegExp(`'${column}'`), `${column} must be asserted after migration`);
    }

    assert.match(sql, /stripe_subscription_id where provider_subscription_ref is null/i);
    assert.match(sql, /stripe_customer_id where provider_customer_ref is null/i);
    assert.match(sql, /plan_key where plan_slug is null/i);
    assert.match(sql, /tier where plan_slug is null/i);
    assert.match(
      sql,
      /create unique index if not exists billing_subscriptions_provider_subscription_key\s+on public\.billing_subscriptions \(provider, provider_subscription_ref\)/i
    );
    assert.match(sql, /'billing_subscriptions_provider_subscription_key'/);
  });

  it("declares only evidence-backed operational indexes", function() {
    const sql = read(migrationPath);
    const { DATABASE_INDEXES, DATABASE_TABLES } = require("../lib/sonara-database-contract.cjs");

    assert.equal(DATABASE_INDEXES.length, 8);
    assert.equal(new Set(DATABASE_INDEXES.map((index) => index.name)).size, DATABASE_INDEXES.length);

    for (const index of DATABASE_INDEXES) {
      assert.ok(DATABASE_TABLES.includes(index.table), `${index.name} references a canonical table`);
      assert.match(
        sql,
        new RegExp(`create index if not exists ${index.name}\\s+on public\\.${index.table}\\b`, "i"),
        `${index.name} must be created on public.${index.table}`
      );
      assert.match(sql, new RegExp(`'${index.name}'`), `${index.name} must be asserted after creation`);
    }

    assert.match(
      sql,
      /business_memberships_active_manager_lookup_idx\s+on public\.business_memberships \(user_id, created_at, workspace_id\)/i
    );
    assert.doesNotMatch(sql, /create\s+table/i);
    assert.doesNotMatch(sql, /grant\s+/i);
    assert.doesNotMatch(sql, /alter\s+table[^;]+disable\s+row\s+level\s+security/i);
  });
});
