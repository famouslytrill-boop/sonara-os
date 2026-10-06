"use strict";

// The real receipts delegate to a local REST client. A missing /rest/v1 literal
// inside the route body does not make a purchase page a static page.
const assert = require("node:assert/strict");
const inventory = require("../data/capability-inventory.json");

function operation(id) {
  const row = inventory.routeOperations.find((candidate) => candidate.id === id);
  assert.ok(row, `No registered operation: ${id}`);
  return row;
}

describe("a commerce receipt is a database read", () => {
  for (const [id, tables] of [
    ["GET /account/purchases", ["creator_marketplace_orders"]],
    ["GET /marketplace/orders/:orderId", ["creator_marketplace_orders", "creator_licence_grants"]],
    ["GET /marketplace/orders/:orderId/download", ["creator_marketplace_orders", "creator_licence_grants", "creator_version_files"]],
    ["GET /store/:slug/orders/:orderId", ["merchant_orders", "merchant_order_lines", "merchant_storefronts"]],
    ["POST /marketplace/:id/buy", ["creator_listings", "creator_asset_versions", "creator_asset_approvals", "creator_version_files", "creator_marketplace_orders"]],
    ["POST /api/webhooks/stripe-connect", ["creator_marketplace_orders", "creator_licence_grants", "creator_marketplace_payment_events"]]
  ]) {
    it(`traces ${id} to the tables its handler and helpers actually access`, () => {
      const row = operation(id);
      for (const table of tables) {
        assert.ok(row.data.directTables.includes(table), `${id} lost ${table}`);
        const lineage = row.data.tableLineage.find((entry) => entry.table === table);
        assert.ok(lineage?.migrationLineage.createdBy.length, `${table} has no creating migration evidence`);
      }
      assert.equal(row.data.noPersistenceReason, null);
      assert.notEqual(row.data.mappingStatus, "needs_explicit_data_contract");
    });
  }

  it("does not assign every table in a commerce module to the purchases page", () => {
    const row = operation("GET /account/purchases");
    assert.ok(row.data.candidateTables.includes("creator_version_files"), "The negative subject is no longer a module candidate");
    assert.ok(!row.data.directTables.includes("creator_version_files"));
    assert.ok(!row.data.directTables.includes("creator_asset_approvals"));
  });
});
