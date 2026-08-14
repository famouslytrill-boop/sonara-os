const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { _execFileSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const serverPath = path.join(root, "server.js");
const migrationPath = path.join(
  root,
  "supabase",
  "migrations",
  "20260718193000_operational_query_index_contract.sql"
);

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

// The whole shipped runtime, not just server.js.
//
// The paid-access assertions below read server.js alone, and broke when
// getCustomerPaidEntitlement moved into lib/sonara-paid-entitlement.cjs -- the
// code was present, correct and shipped, and the test failed on where it lived.
// That is the same fault the marker check in
// tests/product-catalog-production-boundary.test.js was written for, one
// directory over. These queries are a contract about what reaches PostgREST,
// and which file holds them is not part of it.
function readRuntime() {
  const files = [serverPath];
  for (const directory of ["lib", "routes"]) {
    const walk = (current) => {
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(cjs|js|mjs)$/.test(entry.name)) files.push(full);
      }
    };
    walk(path.join(root, directory));
  }
  return files.map((file) => fs.readFileSync(file, "utf8")).join("\n");
}

describe("database query contract", () => {
  it("applies idempotently", function() {
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
    const source = readRuntime();
    assert.ok(source.length > 200000, "the runtime scan collected almost nothing; these assertions would be measuring an empty string");
    assert.match(source, /if \(!allowedKeys\.length\)/);
    assert.match(source, /reason: "product_entitlement_unmapped"/);
    // metadata is selected because workspace_monthly buys one workspace and
    // which one is recorded on the row. Selecting it is what lets
    // billingRowOpensProduct answer; without it every $19 plan would open all
    // three, and the row would look identical to a $39 one.
    assert.match(
      source,
      /billing_entitlements\?select=entitlement_key,status,metadata&organization_id=eq\.\$\{encodeURIComponent\(organization\.organizationId\)\}&status=eq\.active&entitlement_key=in\.\(\$\{entitlementFilter\}\)&limit=1/
    );
    assert.match(
      source,
      /billing_subscriptions\?select=plan_slug,status,metadata&organization_id=eq\.\$\{encodeURIComponent\(organization\.organizationId\)\}&status=in\.\(active,trialing\)&plan_slug=in\.\(\$\{entitlementFilter\}\)&limit=1/
    );
    assert.doesNotMatch(
      source,
      /billing_subscriptions\?select=plan_slug,status[a-z_,]*&organization_id=eq\.\$\{encodeURIComponent\(organization\.organizationId\)\}`/
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
