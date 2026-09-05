"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  buildTenantQuery,
  fetchTenantRows,
  TenantScopeError
} = require("../lib/sonara-tenant-data.cjs");
const { TENANT_SCOPED_TABLES, GLOBAL_TABLES } = require("../lib/sonara-tenant-scoped-tables.cjs");

describe("tenant-scoped query construction", () => {
  it("refuses to build a tenant query without an organization", () => {
    assert.throws(
      () => buildTenantQuery("launch_checklist_items", { select: "id,title" }),
      (error) => error instanceof TenantScopeError && /no organizationId was supplied/.test(error.message)
    );
  });

  it("emits the tenant filter when an organization is supplied", () => {
    const query = buildTenantQuery("launch_checklist_items", {
      organizationId: "11111111-1111-1111-1111-111111111111",
      select: "id,title"
    });
    assert.match(query, /^\/rest\/v1\/launch_checklist_items\?/);
    assert.match(query, /organization_id=eq\.11111111-1111-1111-1111-111111111111/);
  });

  it("allows a cross-tenant read only when it is declared and justified", () => {
    assert.throws(
      () => buildTenantQuery("support_requests", { scope: "global" }),
      (error) => error instanceof TenantScopeError && /globalReason/.test(error.message),
      "a global scope with no reason must be rejected"
    );

    assert.throws(
      () => buildTenantQuery("support_requests", { scope: "global", globalReason: "admin" }),
      TenantScopeError,
      "a token-length reason is not a justification"
    );

    const query = buildTenantQuery("support_requests", {
      scope: "global",
      globalReason: "founder support queue at /admin/support, gated by requireAdmin",
      select: "reference_id,category",
      limit: 20
    });
    assert.doesNotMatch(query, /organization_id/);
    assert.match(query, /limit=20/);
  });

  it("rejects an unknown scope rather than defaulting to global", () => {
    assert.throws(
      () => buildTenantQuery("customers", { scope: "everything", organizationId: "org-1" }),
      TenantScopeError
    );
  });

  it("encodes filter values so they cannot inject PostgREST parameters", () => {
    const query = buildTenantQuery("customers", {
      organizationId: "org-1",
      eq: { email: "a@b.com&role=eq.owner" }
    });
    assert.doesNotMatch(query, /&role=eq\.owner/, "an injected parameter must not survive encoding");
    assert.match(query, /email=eq\.a%40b\.com%26role%3Deq\.owner/);
  });

  it("refuses a second filter on the tenant column", () => {
    assert.throws(
      () => buildTenantQuery("customers", { organizationId: "org-1", eq: { organization_id: "org-2" } }),
      (error) => error instanceof TenantScopeError && /do not filter on organization_id/.test(error.message),
      "contradicting the tenant scope must be impossible, not merely discouraged"
    );
  });

  it("rejects non-scalar and empty scope values", () => {
    assert.throws(() => buildTenantQuery("customers", { organizationId: "" }), TenantScopeError);
    assert.throws(() => buildTenantQuery("customers", { organizationId: {} }), TenantScopeError);
    assert.throws(() => buildTenantQuery("customers", { organizationId: ["org-1", "org-2"] }), TenantScopeError);
  });

  it("rejects table and column names that are not plain identifiers", () => {
    assert.throws(() => buildTenantQuery("customers;drop", { organizationId: "org-1" }), TenantScopeError);
    assert.throws(
      () => buildTenantQuery("customers", { organizationId: "org-1", eq: { "email,role": "x" } }),
      TenantScopeError
    );
  });

  it("bounds limit rather than trusting the caller", () => {
    assert.throws(() => buildTenantQuery("customers", { organizationId: "o", limit: 0 }), TenantScopeError);
    assert.throws(() => buildTenantQuery("customers", { organizationId: "o", limit: 5000 }), TenantScopeError);
    assert.throws(() => buildTenantQuery("customers", { organizationId: "o", limit: 1.5 }), TenantScopeError);
  });

  it("surfaces a missing scope as a thrown error, not an empty result set", async () => {
    // An empty array would read as "this tenant has no rows" and hide the bug.
    await assert.rejects(
      () => fetchTenantRows("customers", {}, { getSupabaseServerConfig: () => ({ ok: true, url: "http://x", serviceRoleKey: "k" }) }),
      TenantScopeError
    );
  });
});

// Every table a query names must be one the guard knows about.
//
// This used to be a ratchet on the number of raw /rest/v1/ call sites, on the
// theory that fewer raw queries meant fewer chances to forget a tenant scope.
// lib/sonara-tenant-guard.cjs now enforces the scope itself, at the fetch, so a
// raw call site is no longer the risk it was and counting them measures style
// rather than safety.
//
// The guard does have one real gap: it decides what to enforce from a generated
// list of tables, and a table missing from that list is waved through. That is
// deliberate -- blocking an unrecognised name would turn a stale list into an
// outage -- but it means the list going stale is the way the guard quietly
// stops guarding. This is the test for that.
describe("the guard knows every table the code queries by name", () => {
  it("recognises each literal table name in a PostgREST path", () => {
    const root = path.join(__dirname, "..");

    // Every directory that issues a PostgREST request, not only the ones that
    // did when this test was written. It scanned server.js and routes/ only,
    // and lib/ queries PostgREST too -- lib/sonara-billing.cjs,
    // lib/sonara-module-crud.cjs and lib/sonara-agent-action-log.cjs among
    // them. A table queried from lib/ and created by no migration was invisible
    // to this test and waved through by the guard, which is exactly the pair of
    // blind spots this test exists to prevent. Nothing was actually wrong when
    // the gap was found -- the scan simply could not have said so.
    const SCANNED_DIRS = ["routes", "lib", "api"];
    const files = [path.join(root, "server.js")];

    for (const dir of SCANNED_DIRS) {
      const absolute = path.join(root, dir);
      if (!fs.existsSync(absolute)) continue;
      for (const name of fs.readdirSync(absolute)) {
        if (/\.(c?js|mjs|ts)$/.test(name)) files.push(path.join(absolute, name));
      }
    }

    const unknown = new Map();
    let literalCount = 0;

    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      // Literal names only. A `/rest/v1/${table}` is resolved at runtime and
      // cannot be checked from here -- the guard still inspects it when the
      // request is actually made.
      for (const match of source.matchAll(/\/rest\/v1\/([a-z0-9_]+)/g)) {
        const table = match[1];
        if (table === "rpc") continue;
        literalCount += 1;
        if (TENANT_SCOPED_TABLES.has(table) || GLOBAL_TABLES.has(table)) continue;
        if (!unknown.has(table)) unknown.set(table, path.relative(root, file));
      }
    }

    assert.ok(files.length > 25, `only ${files.length} files scanned; the directory walk is not finding the source`);
    assert.ok(literalCount > 20, `only ${literalCount} literal table names found; the scan is not working`);

    assert.deepEqual(
      [...unknown.entries()].map(([table, file]) => `${table} (${file})`),
      [],
      "These tables are queried but appear in no migration, so the tenant guard does not know " +
        "whether they carry organization_id and will let their queries through unchecked.\n" +
        "Either the migration is missing, or lib/sonara-tenant-scoped-tables.cjs is stale -- " +
        "run `pnpm run gen:tenant-tables`."
    );
  });
});

// The guard returned an `unrecognised` field and nothing ever read it.
//
// install() checked verdict.allowed and stopped. A table in neither generated
// list was waved through in silence, so the gap and its cover story were the
// same sentence -- "allow it and say so". It allowed. It did not say.
describe("an unrecognised table does not pass quietly", () => {
  const guard = require("../lib/sonara-tenant-guard.cjs");

  it("reports a table it has never heard of rather than failing closed", () => {
    const verdict = guard.inspect("GET", "https://db.example.co/rest/v1/a_table_no_migration_creates?select=*");
    assert.equal(verdict.allowed, true, "failing closed here would turn a stale list into an outage");
    assert.equal(verdict.unrecognised, "a_table_no_migration_creates");
  });

  it("says nothing about a table it does know", () => {
    const known = [...TENANT_SCOPED_TABLES][0];
    const verdict = guard.inspect("GET", `https://db.example.co/rest/v1/${known}?organization_id=eq.org-1`);
    assert.equal(verdict.allowed, true);
    assert.equal(verdict.unrecognised, undefined, "a known table must not produce a warning");
  });

  it("still refuses an unscoped query against a table it does know", () => {
    assert.ok(TENANT_SCOPED_TABLES.has("agent_action_logs"), "agent_action_logs must be recognised as tenant-scoped");
    const verdict = guard.inspect("GET", "https://db.example.co/rest/v1/agent_action_logs?select=*");
    assert.equal(verdict.allowed, false, "adding the report must not have loosened the refusal");
  });

  it("wires the report through install rather than only computing it", async () => {
    const seen = [];
    const scope = { fetch: async (url) => ({ ok: true, url: String(url) }) };

    // install() tracks the target rather than a module-level boolean. It used
    // to be a boolean, so once anything in the suite had installed the guard
    // this call returned false, scope.fetch stayed unwrapped, and the test
    // below passed while exercising nothing. Asserting the return value is what
    // keeps it from going quietly vacuous again.
    assert.equal(
      guard.install({ global: scope, onUnrecognised: (table) => seen.push(table) }),
      true,
      "install() was a no-op, so this test is not exercising the guard"
    );

    await scope.fetch("https://db.example.co/rest/v1/a_table_no_migration_creates?select=*");
    await scope.fetch("https://db.example.co/rest/v1/a_table_no_migration_creates?select=id");

    assert.deepEqual(seen, ["a_table_no_migration_creates"], "reported once per table, not once per request");
    assert.equal(guard.install({ global: scope }), false, "installing twice on one target must stay a no-op");
  });
});

// What this file proves, and what it does not.
//
// Everything above is a statement about `lib/sonara-tenant-data.cjs`: given a
// tenant-scoped table and no organization, it throws. That is true and worth
// keeping. It is **not** a statement about the application, and a file called
// `tenant-isolation.test.js` sitting green is easy to read as one.
//
// The module is available, not enforced. It is called from one file and five
// call sites; the runtime has 126 PostgREST call sites. On the other 121 the
// boundary is a developer remembering to append `&organization_id=eq.<id>`,
// which was re-audited by hand on 3 September 2026 and found intact -- and by
// hand is the only way it has ever been checked.
//
// So the numbers are pinned here, derived from the source rather than typed in,
// for two reasons. A count that drops means somebody removed the guard from the
// one place using it. A count that rises means somebody migrated a file, and
// the test says so out loud instead of letting the improvement go unrecorded.
describe("how far the tenant guard actually reaches", () => {
  const fsx = require("node:fs");
  const pathx = require("node:path");
  const ROOT = pathx.join(__dirname, "..");

  function runtimeFiles() {
    const found = [];
    for (const dir of ["lib", "routes"]) {
      for (const name of fsx.readdirSync(pathx.join(ROOT, dir))) {
        if (name.endsWith(".cjs")) found.push(pathx.join(dir, name));
      }
    }
    found.push("server.js");
    return found;
  }

  const portablePath = (value) => value.split(pathx.sep).join("/");

  const files = runtimeFiles();
  const sources = new Map(files.map((rel) => [rel, fsx.readFileSync(pathx.join(ROOT, rel), "utf8")]));

  let callSites = 0;
  const adopters = [];
  let guardCalls = 0;
  for (const [rel, source] of sources) {
    callSites += (source.match(/rest\/v1\//g) || []).length;
    if (rel.endsWith("sonara-tenant-data.cjs")) continue;
    const calls = (source.match(/\b(buildTenantQuery|fetchTenantRows)\s*\(/g) || []).length;
    if (calls) { adopters.push(portablePath(rel)); guardCalls += calls; }
  }

  it("counted a runtime worth counting", () => {
    assert.ok(files.length >= 100, `only ${files.length} runtime files; this check has gone blind`);
    assert.ok(callSites >= 80, `only ${callSites} PostgREST call sites found; this check has gone blind`);
  });

  it("is still used by the one file that uses it", () => {
    // A ratchet in the honest direction: this may only grow.
    assert.ok(
      adopters.includes("routes/sonara-agent-activity-routes.cjs"),
      "the agent activity routes no longer build their queries through the tenant guard, so the module is now used " +
        "by nothing at all while its tests still pass"
    );
    assert.ok(
      guardCalls >= 5,
      `the guard is called ${guardCalls} times, down from 5. Removing a call site removes the only enforcement ` +
        "there is; the tests above would stay green either way"
    );
  });

  it("says how little of the runtime that is", () => {
    // Not an aspiration and not a failure -- a fact this file is responsible
    // for keeping current, because it is the fact that stops the green tick
    // above from being read as a guarantee about the application.
    assert.ok(
      callSites > guardCalls * 5,
      `the guard now covers ${guardCalls} of ${callSites} call sites. If adoption has really reached this level, ` +
        "update the header of lib/sonara-tenant-data.cjs and this test rather than relaxing the assertion -- the " +
        "wording in both says the module is available rather than enforced, and that would no longer be true"
    );
  });
});
