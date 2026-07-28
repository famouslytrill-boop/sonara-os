"use strict";

// The multi-tenant boundary, and proof that it is switched on.
//
// Every Supabase call in this application uses the service-role key, which
// bypasses Row Level Security. The ~1,600 RLS policies in the schema protect
// direct Data API access and do nothing for application traffic, so the actual
// boundary between one customer's records and another's is whether a developer
// remembered to write organization_id=eq.<id> into the query.
//
// lib/sonara-tenant-guard.cjs turns that from a habit into a rule. These tests
// exist mostly to stop the rule from quietly becoming a no-op -- a guard that
// permits everything looks exactly like a guard that is working.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const request = require("supertest");

const app = require("../server");
const guard = require("../lib/sonara-tenant-guard.cjs");
const { TENANT_SCOPED_TABLES, GLOBAL_TABLES } = require("../lib/sonara-tenant-scoped-tables.cjs");

const SUPABASE = "https://project.supabase.co";

describe("the tenant guard is actually installed", () => {
  it("blocks an unscoped read through the real global fetch", async () => {
    // Not guard.inspect() -- the wrapper itself. If require("../server") stops
    // installing it, the unit tests below would all still pass while the
    // application ran unguarded.
    await assert.rejects(
      () => fetch(`${SUPABASE}/rest/v1/customer_records?select=*&limit=50`),
      (error) => error.name === "TenantGuardError",
      "requiring the server must install the guard on global fetch"
    );
  });

  it("lets a scoped read past the guard", async () => {
    // Under the suite's offline firewall this resolves to a synthetic 503
    // rather than reaching the network. Either way it must not be the guard
    // that stops it.
    try {
      const response = await fetch(`${SUPABASE}/rest/v1/customer_records?select=*&organization_id=eq.abc&limit=50`);
      assert.ok(response, "a scoped read reached the layer below the guard");
    } catch (error) {
      assert.notEqual(error.name, "TenantGuardError", "a scoped read must not be blocked by the guard");
    }
  });

  it("ignores requests that are not Supabase REST", async () => {
    const verdict = guard.inspect("GET", "https://api.stripe.com/v1/prices/price_123");
    assert.equal(verdict.allowed, true);
  });
});

describe("what the guard refuses", () => {
  const blocked = (method, url, body) => guard.inspect(method, `${SUPABASE}${url}`, body);

  it("refuses an unscoped read of a tenant table", () => {
    const verdict = blocked("GET", "/rest/v1/customer_records?select=*&limit=50");
    assert.equal(verdict.allowed, false);
    assert.match(verdict.message, /across every organization/);
    assert.match(verdict.message, /Fix: add organization_id=eq/);
  });

  it("refuses an unscoped update or delete", () => {
    for (const method of ["PATCH", "DELETE"]) {
      const verdict = blocked(method, "/rest/v1/launch_checklist_items?id=eq.7");
      assert.equal(verdict.allowed, false, `${method} without a tenant must be refused`);
    }
  });

  it("refuses a write whose body names no organization", () => {
    const verdict = blocked("POST", "/rest/v1/customer_records", JSON.stringify({ name: "Ada" }));
    assert.equal(verdict.allowed, false);
  });

  it("refuses a batch where only some rows carry the organization", () => {
    // The dangerous one. A single-row check would pass this and write the
    // remaining rows to whatever the column defaults to.
    const body = JSON.stringify([{ organization_id: "org-1", name: "Ada" }, { name: "Grace" }]);
    assert.equal(blocked("POST", "/rest/v1/customer_records", body).allowed, false);
  });

  it("refuses an empty batch rather than treating it as vacuously scoped", () => {
    assert.equal(guard.bodyCarriesTenant("[]"), false);
  });

  it("refuses a body it cannot parse", () => {
    assert.equal(guard.bodyCarriesTenant("not json"), false);
    assert.equal(guard.bodyCarriesTenant(undefined), false);
  });

  it("is not fooled by the column name appearing somewhere else in the query", () => {
    for (const query of [
      "?select=organization_id,name&limit=50",
      "?order=organization_id.asc&limit=50",
      "?select=*&other_organization_id=eq.x"
    ]) {
      assert.equal(
        blocked("GET", `/rest/v1/customer_records${query}`).allowed,
        false,
        `"${query}" mentions the column without filtering on it`
      );
    }
  });
});

describe("what the guard allows", () => {
  const allowed = (method, url, body) => guard.inspect(method, `${SUPABASE}${url}`, body);

  it("allows a scoped read, with eq or in", () => {
    assert.equal(allowed("GET", "/rest/v1/customer_records?select=*&organization_id=eq.org-1").allowed, true);
    assert.equal(allowed("GET", "/rest/v1/customer_records?select=*&organization_id=in.(a,b)").allowed, true);
  });

  it("allows a write whose every row carries the organization", () => {
    const body = JSON.stringify([{ organization_id: "org-1" }, { organization_id: "org-1" }]);
    assert.equal(allowed("POST", "/rest/v1/customer_records", body).allowed, true);
  });

  it("allows a table with no organization_id column at all", () => {
    assert.equal(allowed("GET", "/rest/v1/feature_flags?select=*").allowed, true);
  });

  it("allows stored procedures, which scope themselves in SQL", () => {
    assert.equal(allowed("POST", "/rest/v1/rpc/sonara_consume_rate_limit", "{}").allowed, true);
  });

  it("allows an existence probe, and only in that exact shape", () => {
    assert.equal(allowed("GET", "/rest/v1/inventory_items?select=id&limit=1").allowed, true);
    // Anything wider is no longer a probe.
    assert.equal(allowed("GET", "/rest/v1/inventory_items?select=id&limit=2").allowed, false);
    assert.equal(allowed("GET", "/rest/v1/inventory_items?select=*&limit=1").allowed, false);
    assert.equal(allowed("GET", "/rest/v1/inventory_items?select=id,name&limit=1").allowed, false);
    assert.equal(allowed("GET", "/rest/v1/inventory_items?select=id&limit=1&order=created_at.desc").allowed, false);
  });

  it("allows a row scoped to one person rather than one organization", () => {
    assert.equal(allowed("GET", "/rest/v1/user_notifications?select=*&user_id=eq.u-1").allowed, true);
  });
});

describe("the exemptions are declared, not implied", () => {
  it("gives every exemption a written reason", () => {
    assert.ok(guard.EXEMPT_PATTERNS.length > 0, "there should be exemptions; unscoped access is sometimes correct");
    for (const exemption of guard.EXEMPT_PATTERNS) {
      assert.ok(exemption.table, "an exemption must name its table");
      assert.ok(
        typeof exemption.reason === "string" && exemption.reason.trim().length >= 40,
        `the exemption for ${exemption.table} needs a reason explaining why crossing tenants is safe`
      );
      assert.equal(typeof exemption.when, "function", `${exemption.table} must say which requests it covers`);
    }
  });

  it("keeps exemptions narrow enough to still refuse the general case", () => {
    // business_employee_invites is exempt for token redemption. That must not
    // have made the whole table readable.
    assert.equal(
      guard.inspect("GET", `${SUPABASE}/rest/v1/business_employee_invites?select=*&limit=100`).allowed,
      false,
      "the invite exemption covers token lookup, not a full table read"
    );
    assert.equal(
      guard.inspect("GET", `${SUPABASE}/rest/v1/business_employee_invites?select=*&token_hash=eq.abc`).allowed,
      true
    );
  });

  it("only exempts tables that exist", () => {
    for (const exemption of guard.EXEMPT_PATTERNS) {
      assert.ok(
        TENANT_SCOPED_TABLES.has(exemption.table) || GLOBAL_TABLES.has(exemption.table),
        `${exemption.table} is exempted but is not a table in any migration`
      );
    }
  });
});

describe("the table list is derived, not remembered", () => {
  it("knows about a realistic number of tenant tables", () => {
    // A parse that silently returned nothing would disable the guard while
    // every test above still passed. 206 were found when written.
    assert.ok(
      TENANT_SCOPED_TABLES.size >= 180,
      `only ${TENANT_SCOPED_TABLES.size} tenant-scoped tables are known; the generated list looks broken`
    );
  });

  it("covers the tables the application actually queries", () => {
    // Spot-check the ones carrying real customer data. If any of these were
    // missing from the list, the guard would wave their queries straight
    // through.
    for (const table of [
      "customer_records",
      "intake_requests",
      "module_outputs",
      "launch_checklist_items",
      "billing_entitlements",
      "billing_subscriptions",
      "service_requests",
      "service_deliverables",
      "activity_events"
    ]) {
      assert.ok(TENANT_SCOPED_TABLES.has(table), `${table} holds customer data and must be guarded`);
    }
  });

  it("is committed in the state the generator produces", () => {
    // supabase/migrations is not bundled into the deployed function, so the
    // list has to be committed. This is the check that keeps the committed
    // copy matching the migrations it claims to describe.
    const generated = fs.readFileSync(path.join(__dirname, "..", "lib", "sonara-tenant-scoped-tables.cjs"), "utf8");
    assert.match(generated, /GENERATED by scripts\/generate-tenant-scoped-tables\.cjs/);
    assert.match(generated, /const TENANT_SCOPED_TABLES = Object\.freeze\(new Set\(\[/);
  });
});

describe("the guard does not break the running application", () => {
  it("serves pages with the guard in the request path", async () => {
    // Every one of these renders while the guard is inspecting whatever they
    // query. A false positive would surface as a 500 rather than a page.
    for (const page of ["/", "/pricing", "/service-catalog", "/readiness", "/support"]) {
      const response = await request(app).get(page).set("accept", "text/html");
      assert.equal(response.status, 200, `${page} must still render with the guard installed`);
    }
  });

  it("composes with the offline firewall the test suite installs", () => {
    // tests/setup-env.cjs tags its fetch so the runtime can tell real traffic
    // is being blocked. Wrapping it must not lose the tag, or the runtime
    // would believe the firewall was gone.
    assert.equal(global.fetch.__sonaraTenantGuard, true, "the guard must be the installed fetch");
    assert.equal(global.fetch.__sonaraOfflineFirewall, true, "the offline firewall tag must survive wrapping");
  });
});
