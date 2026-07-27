"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  buildTenantQuery,
  fetchTenantRows,
  TenantScopeError
} = require("../lib/sonara-tenant-data.cjs");

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

// Ratchet: prevent new raw PostgREST call sites.
//
// The 69 existing sites were audited on 2026-07-27 and none is missing a tenant
// scope, so they are grandfathered rather than rewritten. This test stops the
// count from growing: any new query must go through lib/sonara-tenant-data.cjs,
// where omitting the scope is impossible.
//
// When call sites are migrated to the helper, lower BASELINE to match. It is a
// ratchet, not a floor.
describe("raw PostgREST call sites do not grow", () => {
  const BASELINE = 69;

  it(`has no more than ${BASELINE} raw /rest/v1/ references outside the helper`, () => {
    const root = path.join(__dirname, "..");
    const files = [
      path.join(root, "server.js"),
      ...fs
        .readdirSync(path.join(root, "routes"))
        .filter((name) => name.endsWith(".cjs"))
        .map((name) => path.join(root, "routes", name))
    ];

    const counts = files
      .map((file) => ({
        file: path.relative(root, file),
        count: (fs.readFileSync(file, "utf8").match(/\/rest\/v1\//g) || []).length
      }))
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.count - a.count);

    const total = counts.reduce((sum, entry) => sum + entry.count, 0);

    assert.ok(
      total <= BASELINE,
      `Raw PostgREST call sites grew from ${BASELINE} to ${total}.\n` +
        `New queries must use lib/sonara-tenant-data.cjs, which cannot build a\n` +
        `tenant query without an explicit organizationId.\n\n` +
        counts.map((entry) => `  ${entry.count}  ${entry.file}`).join("\n")
    );

    if (total < BASELINE) {
      console.log(`  note: raw call sites down to ${total}; lower BASELINE in this test to ${total} to hold the gain.`);
    }
  });
});
