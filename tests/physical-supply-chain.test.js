// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert = require("node:assert/strict");
const {
  isValidGtin, normalizeTradeItem, proposeProductionRun,
  proposeShipmentReceipt, proposeReplenishment
} = require("../lib/sonara-physical-supply-chain.cjs");

const SELLER = "11111111-1111-4111-8111-111111111111";
const BUYER = "22222222-2222-4222-8222-222222222222";
const PRODUCT = "33333333-3333-4333-8333-333333333333";
const COMPONENT_A = "44444444-4444-4444-8444-444444444444";
const COMPONENT_B = "55555555-5555-4555-8555-555555555555";
const SHIPMENT = "66666666-6666-4666-8666-666666666666";
const LOCATION = "77777777-7777-4777-8777-777777777777";

function receipt(accepted, rejected, idempotencyKey = "receipt_001", extra = {}) {
  return { idempotencyKey, productId: PRODUCT, lotCode: "LOT-A", unit: "EA", accepted, rejected, ...extra };
}

function shipment(overrides = {}) {
  return {
    sellerOrganizationId: SELLER, buyerOrganizationId: BUYER,
    shipmentId: SHIPMENT, productId: PRODUCT, lotCode: "LOT-A",
    unit: "EA", shippedQuantity: 100, previousReceipts: [],
    receipt: receipt(20, 5),
    ...overrides
  };
}

describe("SONARA physical supply-chain proposals", () => {
  describe("GS1-compatible product identity", () => {
    it("accepts a known valid UPC GTIN without replacing its leading zero", () => {
      assert.equal(isValidGtin("036000291452"), true);
      const item = normalizeTradeItem({ sku: "  CEREAL-12  ", gtin: "036000291452", lotCode: "BATCH-7", unit: "ea" });
      assert.deepEqual(item, {
        sku: "CEREAL-12", gtin: "036000291452", lotCode: "BATCH-7", unit: "EA"
      });
      assert.ok(Object.isFrozen(item));
    });

    it("rejects bad check digits, non-digit identifiers and invented blank codes", () => {
      for (const gtin of ["036000291453", "123456", "0000000A", " 036000291452"]) {
        assert.equal(isValidGtin(gtin), false);
        assert.throws(() => normalizeTradeItem({ sku: "A", gtin, unit: "EA" }), /gtin_invalid/);
      }
      assert.throws(() => normalizeTradeItem({ sku: " ", unit: "EA" }), /sku_invalid/);
      assert.throws(() => normalizeTradeItem({ sku: "ABC", unit: "EA\nDROP" }), /unit_invalid/);
      assert.equal(normalizeTradeItem({ sku: "LOCAL-1", unit: "EA" }).gtin, null);
    });
  });

  describe("producer bill of materials", () => {
    const input = () => ({
      organizationId: SELLER, productId: PRODUCT, outputQuantity: 10,
      components: [
        { componentId: COMPONENT_A, onHand: 30, reserved: 3, quarantined: 0, unitsPerOutput: 2 },
        { componentId: COMPONENT_B, onHand: 28, reserved: 0, quarantined: 1, unitsPerOutput: 3 }
      ]
    });

    it("derives material shortfalls without consuming stock", () => {
      const data = input();
      const before = JSON.stringify(data);
      const result = proposeProductionRun(data);
      assert.equal(result.canStart, false);
      assert.deepEqual(result.requirements.map((part) => part.shortfall), [0, 3]);
      assert.equal(result.requirements[0].required, 20);
      assert.equal(result.state, "proposal_only");
      assert.equal(result.requiresApprovedProductionOrder, true);
      assert.equal(JSON.stringify(data), before);
    });

    it("signals readiness only when every component is sufficient", () => {
      const data = input();
      data.components[1].onHand = 31;
      assert.equal(proposeProductionRun(data).canStart, true);
    });

    it("rejects recursive, duplicate, fractional and overflowing BOMs", () => {
      const recursive = input();
      recursive.components[0].componentId = PRODUCT;
      assert.throws(() => proposeProductionRun(recursive), /recursive_component_invalid/);
      const duplicate = input();
      duplicate.components[1].componentId = COMPONENT_A;
      assert.throws(() => proposeProductionRun(duplicate), /duplicate_component_invalid/);
      const fraction = input();
      fraction.components[0].unitsPerOutput = 0.5;
      assert.throws(() => proposeProductionRun(fraction), /units_per_output_invalid/);
      const overflow = input();
      overflow.outputQuantity = Number.MAX_SAFE_INTEGER;
      assert.throws(() => proposeProductionRun(overflow), /production_requirement_overflow/);
    });
  });

  describe("distributor receipt integrity", () => {
    it("supports partial deliveries, rejection/quarantine and remaining units", () => {
      const data = shipment({
        previousReceipts: [receipt(20, 5, "receipt_001")],
        receipt: receipt(50, 5, "receipt_002")
      });
      const result = proposeShipmentReceipt(data);
      assert.equal(result.alreadyProcessed, 25);
      assert.equal(result.remaining, 20);
      assert.equal(result.acceptedInventoryIncrease, 50);
      assert.equal(result.quarantinedOrRejectedUnits, 5);
      assert.equal(result.requiresPartnerAuthorization, true);
      assert.equal(result.requiresAtomicCommit, true);
      assert.equal(result.state, "proposal_only");
    });

    it("detects identical retries without proposing a second stock increase", () => {
      const existing = receipt(20, 5, "receipt_001");
      const result = proposeShipmentReceipt(shipment({
        previousReceipts: [existing], receipt: { ...existing }
      }));
      assert.equal(result.state, "idempotent_duplicate");
      assert.equal(result.acceptedInventoryIncrease, 0);
      assert.equal(result.remaining, 75);
    });

    it("refuses an idempotency key reused with a changed receipt", () => {
      assert.throws(() => proposeShipmentReceipt(shipment({
        previousReceipts: [receipt(20, 5)], receipt: receipt(21, 5)
      })), /idempotency_key_payload_conflict/);
    });

    it("refuses over-receiving or impossible historical receipt totals", () => {
      assert.throws(() => proposeShipmentReceipt(shipment({
        previousReceipts: [receipt(80, 5)], receipt: receipt(16, 0, "receipt_002")
      })), /over_receipt/);
      assert.throws(() => proposeShipmentReceipt(shipment({
        previousReceipts: [receipt(101, 0)], receipt: receipt(1, 0, "receipt_002")
      })), /historical_over_receipt/);
    });

    it("rejects mismatched lots, products, units and missing independent partners", () => {
      assert.throws(() => proposeShipmentReceipt(shipment({
        receipt: receipt(2, 0, "receipt_002", { lotCode: "LOT-B" })
      })), /receipt_identity_mismatch/);
      assert.throws(() => proposeShipmentReceipt(shipment({
        receipt: receipt(2, 0, "receipt_002", { productId: COMPONENT_A })
      })), /receipt_identity_mismatch/);
      assert.throws(() => proposeShipmentReceipt(shipment({
        receipt: receipt(2, 0, "receipt_002", { unit: "KG" })
      })), /receipt_identity_mismatch/);
      assert.throws(() => proposeShipmentReceipt(shipment({
        buyerOrganizationId: SELLER
      })), /separate_trading_partners_required/);
    });

    it("refuses duplicate stored receipt keys and empty receipts", () => {
      assert.throws(() => proposeShipmentReceipt(shipment({
        previousReceipts: [receipt(10, 0), receipt(10, 0)]
      })), /duplicate_stored_receipt_key/);
      assert.throws(() => proposeShipmentReceipt(shipment({
        receipt: receipt(0, 0)
      })), /empty_receipt/);
    });
  });

  describe("retailer replenishment", () => {
    const input = () => ({
      organizationId: BUYER, productId: PRODUCT, locationId: LOCATION,
      onHand: 40, reserved: 8, quarantined: 2, safetyStock: 5,
      incomingApproved: 5, reorderPoint: 35, targetStock: 70
    });

    it("calculates availability, includes approved incoming stock and suggests a draft", () => {
      const result = proposeReplenishment(input());
      assert.equal(result.availableToPromise, 25);
      assert.equal(result.projected, 30);
      assert.equal(result.suggestedQuantity, 40);
      assert.equal(result.reorderTriggered, true);
      assert.equal(result.createsPurchaseOrder, false);
      assert.equal(result.requiresBuyerApproval, true);
    });

    it("does not reorder when incoming stock covers the threshold", () => {
      const data = input();
      data.incomingApproved = 20;
      assert.equal(proposeReplenishment(data).suggestedQuantity, 0);
    });

    it("rejects negative/fractional counts, invalid policy and unsafe sums", () => {
      const negative = input();
      negative.onHand = -1;
      assert.throws(() => proposeReplenishment(negative), /on_hand_invalid/);
      const fractional = input();
      fractional.reserved = 1.2;
      assert.throws(() => proposeReplenishment(fractional), /reserved_invalid/);
      const invalidTarget = input();
      invalidTarget.targetStock = 20;
      assert.throws(() => proposeReplenishment(invalidTarget), /target_below_reorder_point/);
      const overflow = input();
      overflow.onHand = Number.MAX_SAFE_INTEGER;
      overflow.incomingApproved = Number.MAX_SAFE_INTEGER;
      assert.throws(() => proposeReplenishment(overflow), /projected_stock_overflow/);
    });
  });
});
