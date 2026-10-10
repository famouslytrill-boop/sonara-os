// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Deterministic, side-effect-free proposals for physical-goods workflows.
// NO database writes, cross-tenant reads, spend, stock mutation or EPCIS export.
// Callers must load records using server-derived tenant authority and commit
// through a single audited, idempotent, locked database transaction.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GTIN_LENGTHS = Object.freeze([8, 12, 13, 14]);

function identifier(value, label) {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new TypeError(label + "_invalid");
  }
  return value.toLowerCase();
}

function code(value, label, maxLength = 128) {
  if (typeof value !== "string") throw new TypeError(label + "_invalid");
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || /[\x00-\x1f\x7f]/.test(normalized)) {
    throw new TypeError(label + "_invalid");
  }
  return normalized;
}

function quantity(value, label, zeroAllowed = true) {
  if (!Number.isSafeInteger(value) || value < 0 || (!zeroAllowed && value === 0)) {
    throw new RangeError(label + "_invalid");
  }
  return value;
}

function add(a, b, label) {
  const result = a + b;
  if (!Number.isSafeInteger(result)) throw new RangeError(label + "_overflow");
  return result;
}

function multiply(a, b, label) {
  const result = a * b;
  if (!Number.isSafeInteger(result)) throw new RangeError(label + "_overflow");
  return result;
}

function isValidGtin(gtin) {
  if (typeof gtin !== "string" || !GTIN_LENGTHS.includes(gtin.length) || !/^\d+$/.test(gtin)) return false;
  let total = 0;
  for (let i = gtin.length - 2, weight = 3; i >= 0; i--, weight = weight === 3 ? 1 : 3) {
    total += Number(gtin[i]) * weight;
  }
  return (10 - (total % 10)) % 10 === Number(gtin[gtin.length - 1]);
}

function normalizeTradeItem({ sku, gtin = null, lotCode = null, unit }) {
  const result = {
    sku: code(sku, "sku", 80),
    gtin: null,
    lotCode: lotCode === null ? null : code(lotCode, "lot_code", 80),
    unit: code(unit, "unit", 32).toUpperCase()
  };
  if (gtin !== null) {
    if (!isValidGtin(gtin)) throw new TypeError("gtin_invalid");
    result.gtin = gtin; // A GTIN is issued/verified externally, never generated here.
  }
  return Object.freeze(result);
}

function availability(onHand, reserved, quarantined, safetyStock = 0) {
  const deductions = add(add(reserved, quarantined, "stock_deductions"), safetyStock, "stock_deductions");
  return Math.max(0, onHand - deductions);
}

// Producer: check a BOM in integer base units; no inventory is consumed here.
function proposeProductionRun({ organizationId, productId, outputQuantity, components }) {
  const organization = identifier(organizationId, "organization_id");
  const product = identifier(productId, "product_id");
  const planned = quantity(outputQuantity, "output_quantity", false);
  if (!Array.isArray(components) || components.length === 0 || components.length > 500) {
    throw new RangeError("components_invalid");
  }
  const ids = new Set();
  const requirements = components.map((part) => {
    const componentId = identifier(part.componentId, "component_id");
    if (componentId === product) throw new TypeError("recursive_component_invalid");
    if (ids.has(componentId)) throw new TypeError("duplicate_component_invalid");
    ids.add(componentId);
    const perOutput = quantity(part.unitsPerOutput, "units_per_output", false);
    const onHand = quantity(part.onHand, "on_hand");
    const reserved = quantity(part.reserved, "reserved");
    const quarantined = quantity(part.quarantined, "quarantined");
    const required = multiply(planned, perOutput, "production_requirement");
    const available = availability(onHand, reserved, quarantined);
    return Object.freeze({
      componentId, required, available,
      shortfall: Math.max(0, required - available)
    });
  });
  return Object.freeze({
    organizationId: organization,
    productId: product,
    outputQuantity: planned,
    canStart: requirements.every((part) => part.shortfall === 0),
    requirements: Object.freeze(requirements),
    state: "proposal_only",
    requiresApprovedProductionOrder: true
  });
}

function receiptPart(part, label) {
  if (!part || typeof part !== "object") throw new TypeError(label + "_invalid");
  return {
    idempotencyKey: code(part.idempotencyKey, label + "_idempotency_key"),
    productId: identifier(part.productId, label + "_product_id"),
    lotCode: code(part.lotCode, label + "_lot_code", 80),
    unit: code(part.unit, label + "_unit", 32).toUpperCase(),
    accepted: quantity(part.accepted, label + "_accepted"),
    rejected: quantity(part.rejected, label + "_rejected")
  };
}

function equalReceipt(a, b) {
  return ["productId", "lotCode", "unit", "accepted", "rejected"].every((key) => a[key] === b[key]);
}

// Distributor/buyer: validate the proposed receiving quantity and retry contract.
// Existing receipts MUST be loaded under lock from the authoritative shipment
// and not accepted from a browser. This function cannot verify partner grants.
function proposeShipmentReceipt({
  sellerOrganizationId, buyerOrganizationId, shipmentId,
  productId, lotCode, unit, shippedQuantity,
  previousReceipts = [], receipt
}) {
  const seller = identifier(sellerOrganizationId, "seller_organization_id");
  const buyer = identifier(buyerOrganizationId, "buyer_organization_id");
  if (seller === buyer) throw new TypeError("separate_trading_partners_required");
  const shipment = identifier(shipmentId, "shipment_id");
  const product = identifier(productId, "product_id");
  const lot = code(lotCode, "lot_code", 80);
  const shipped = quantity(shippedQuantity, "shipped_quantity", false);
  const canonicalUnit = code(unit, "unit", 32).toUpperCase();
  if (!Array.isArray(previousReceipts) || previousReceipts.length > 10000) {
    throw new RangeError("previous_receipts_invalid");
  }
  const seen = new Map();
  let alreadyProcessed = 0;
  for (const input of previousReceipts) {
    const part = receiptPart(input, "previous_receipt");
    if (part.productId !== product || part.lotCode !== lot || part.unit !== canonicalUnit) {
      throw new TypeError("receipt_identity_mismatch");
    }
    if (seen.has(part.idempotencyKey)) throw new TypeError("duplicate_stored_receipt_key");
    seen.set(part.idempotencyKey, part);
    alreadyProcessed = add(alreadyProcessed, add(part.accepted, part.rejected, "receipt_quantity"), "receipt_quantity");
    if (alreadyProcessed > shipped) throw new RangeError("historical_over_receipt");
  }
  const proposed = receiptPart(receipt, "receipt");
  if (proposed.productId !== product || proposed.lotCode !== lot || proposed.unit !== canonicalUnit) {
    throw new TypeError("receipt_identity_mismatch");
  }
  const proposedQuantity = add(proposed.accepted, proposed.rejected, "receipt_quantity");
  if (proposedQuantity === 0) throw new RangeError("empty_receipt");
  const existing = seen.get(proposed.idempotencyKey);
  if (existing) {
    if (!equalReceipt(existing, proposed)) throw new TypeError("idempotency_key_payload_conflict");
    return Object.freeze({
      shipmentId: shipment, sellerOrganizationId: seller, buyerOrganizationId: buyer,
      state: "idempotent_duplicate", alreadyProcessed, remaining: shipped - alreadyProcessed,
      acceptedInventoryIncrease: 0, requiresAtomicCommit: false
    });
  }
  const nextTotal = add(alreadyProcessed, proposedQuantity, "receipt_quantity");
  if (nextTotal > shipped) throw new RangeError("over_receipt");
  return Object.freeze({
    shipmentId: shipment, sellerOrganizationId: seller, buyerOrganizationId: buyer,
    productId: product, lotCode: lot, unit: canonicalUnit,
    idempotencyKey: proposed.idempotencyKey,
    accepted: proposed.accepted, rejected: proposed.rejected,
    alreadyProcessed, remaining: shipped - nextTotal,
    acceptedInventoryIncrease: proposed.accepted,
    quarantinedOrRejectedUnits: proposed.rejected,
    state: "proposal_only",
    requiresAtomicCommit: true,
    requiresPartnerAuthorization: true
  });
}

// Retailer: recommend a draft replenishment; never issue a PO automatically.
// All amounts are nonnegative integer base units for one product/location.
function proposeReplenishment({
  organizationId, productId, locationId, onHand,
  reserved = 0, quarantined = 0, safetyStock = 0,
  incomingApproved = 0, reorderPoint, targetStock
}) {
  const organization = identifier(organizationId, "organization_id");
  const product = identifier(productId, "product_id");
  const location = identifier(locationId, "location_id");
  const stock = quantity(onHand, "on_hand");
  const held = quantity(reserved, "reserved");
  const blocked = quantity(quarantined, "quarantined");
  const safety = quantity(safetyStock, "safety_stock");
  const incoming = quantity(incomingApproved, "incoming_approved");
  const point = quantity(reorderPoint, "reorder_point");
  const target = quantity(targetStock, "target_stock");
  if (target < point) throw new RangeError("target_below_reorder_point");
  const availableToPromise = availability(stock, held, blocked, safety);
  const projected = add(availableToPromise, incoming, "projected_stock");
  const suggestedQuantity = projected <= point ? Math.max(0, target - projected) : 0;
  return Object.freeze({
    organizationId: organization, productId: product, locationId: location,
    availableToPromise, projected, suggestedQuantity,
    reorderTriggered: suggestedQuantity > 0,
    state: "proposal_only", createsPurchaseOrder: false,
    requiresBuyerApproval: true
  });
}

module.exports = Object.freeze({
  isValidGtin, normalizeTradeItem, proposeProductionRun,
  proposeShipmentReceipt, proposeReplenishment
});
