"use strict";

// What scripts/generate-capability-inventory.cjs reads a route's tables from,
// pinned to one route for each way that reading was wrong before 6 October
// 2026. Every case here was a route the inventory either listed for review or
// labelled "no persistent table expected" while the handler read or wrote one.
//
// Each assertion is the route that defect hid. Put the defect back and the
// route loses the table it names.

const assert = require("node:assert/strict");
const inventory = require("../data/capability-inventory.json");

function route(id) {
  const row = inventory.routeOperations.find((candidate) => candidate.id === id);
  assert.ok(row, `No registered operation: ${id}`);
  return row;
}

function reaches(id, tables) {
  const row = route(id);
  for (const table of tables) assert.ok(row.data.directTables.includes(table), `${id} no longer traces to ${table}; it traces to ${JSON.stringify(row.data.directTables)}`);
  assert.notEqual(row.data.mappingStatus, "needs_explicit_data_contract", `${id} is back on the review list`);
  assert.equal(row.data.noPersistenceReason, null, `${id} is labelled as reading nothing`);
  return row;
}

describe("the inventory traces what a route calls", () => {
  it("measures the whole application", () => {
    assert.ok(inventory.routeOperations.length >= 900, `only ${inventory.routeOperations.length} routes; the generator has gone blind`);
    assert.ok(inventory.summary.routeDataMappingCounts.handler_source_table_reference >= 450, "far fewer routes trace to a table than on 6 October 2026");
  });

  it("reads the handler a route registered, not the async safety net around it", () => {
    // Every handler is wrapped by lib/sonara-async-route-safety.cjs, and the
    // wrapper's source is the same seven lines for all 930 routes.
    reaches("GET /business-builder/tools/break-even", ["module_outputs"]);
  });

  it("follows a helper the route was handed by server.js", () => {
    // saveModuleOutput arrives in `deps`; it is neither defined nor required here.
    reaches("POST /business-builder/tools/break-even", ["module_outputs"]);
  });

  it("reads a table through a local wrapper that puts its argument after /rest/v1/", () => {
    reaches("POST /creator-studio/owner/marketplace", ["creator_listings"]);
  });

  it("reads a table through a wrapper defined in server.js and handed over", () => {
    reaches("GET /creator-studio/rights", ["creator_voice_consents"]);
  });

  it("records a function whose parameter defaults contain parentheses", () => {
    // createCreatorProjectStore({ fetch: request = (...args) => fetch(...args) })
    reaches("GET /api/creator-studio/projects", ["creator_projects"]);
  });

  it("binds a handler from the literal list a loop registered it from, and only that one", () => {
    const evidence = reaches("POST /product-lifecycle/initiatives/:initiativeId/evidence", ["product_lifecycle_evidence"]);
    assert.ok(!evidence.data.directTables.includes("product_lifecycle_feedback"), "the evidence route was credited with the feedback handler's table");
    reaches("POST /product-lifecycle/initiatives/:initiativeId/feedback", ["product_lifecycle_feedback"]);
  });

  it("reads the table a Map entry names for the route registered from it", () => {
    reaches("GET /api/integrations/providers", ["integration_providers"]);
  });

  it("places a callback-registered route at an actionable registration site", () => {
    // A route may be registered directly with app.get(...) or through a local
    // registration helper. The inventory's source must still lead a reviewer
    // to the registration statement, not merely the enclosing callback.
    const row = route("GET /api/integrations/providers");
    assert.equal(row.source.file, "routes/sonara-last9-routes.cjs");
    const source = require("node:fs").readFileSync(row.source.file, "utf8");
    const line = source.split("\n")[row.source.line - 1];
    const direct = /app\.get\(/.test(line);
    const helper = /registerRestResource\(/.test(line);
    assert.ok(direct || helper, "inventory source is not a direct or helper route registration: " + line);
    if (helper) {
      assert.match(source, /function\s+registerRestResource\s*\(/);
      assert.match(source, /function\s+registerRestResource[\s\S]*?app\.get\(path,/);
    }
  });

  it("follows the handler a registration helper was given, including inside a nested call", () => {
    // registerCatalogRoute(path, handler) runs Promise.resolve(handler(req, res)).
    reaches("GET /business-builder/catalog", ["service_catalog_items"]);
    reaches("GET /service-catalog", ["service_catalog_items"]);
  });

  it("follows a call into a module that exports an object", () => {
    // twoFactor.completeChallenge(store, ...) with module.exports = { ... }.
    reaches("POST /login/verify", ["pending_auth_challenges", "user_auth_factors"]);
  });

  it("names a Supabase Auth endpoint as the data contract when no table is involved", () => {
    const row = route("POST /auth/forgot-password");
    assert.equal(row.data.mappingStatus, "provider_endpoint_reference");
    assert.ok(row.data.providerEndpoints.includes("supabase_auth:recover"));
  });

  it("says when the trace stopped early, and it did not", () => {
    assert.deepEqual(inventory.summary.routesTruncatedByPersistenceTraceBudget, []);
    assert.ok(inventory.summary.persistenceTraceFunctionBudget >= 400);
  });

  it("matches a templated form action against the routes it can reach, and names it", () => {
    const matched = inventory.summary.templatedFormActionsMatchedByPattern["POST /api/growth/:parameter"];
    assert.ok(Array.isArray(matched) && matched.includes("POST /api/growth/segments"), "the growth create forms are no longer matched");
    assert.equal(inventory.summary.formActionsWithoutRegisteredRoute, 0);
  });

  it("still keeps a module's other tables off a page that does not touch them", () => {
    const purchases = route("GET /account/purchases");
    assert.ok(!purchases.data.directTables.includes("creator_version_files"));
    assert.ok(!purchases.data.directTables.includes("creator_asset_approvals"));
  });
});
