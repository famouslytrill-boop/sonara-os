// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// A cycle count is evidence, not an instruction to mutate stock. This module
// cannot grant access or reserve stock. A trusted server must load tenant-scoped
// snapshots, validate actors, lock rows, recalculate and post any actual change.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REASONS = Object.freeze(new Set(["cycle_count", "damaged", "expired", "shrinkage", "customer_return", "supplier_correction"]));

function uuid(value, name) {
  if (typeof value !== "string" || !UUID.test(value)) throw new TypeError(name + "_invalid");
  return value.toLowerCase();
}
function units(value, name) {
  if (typeof value !== "string" || !/^[a-z][a-z0-9_-]{0,30}$/i.test(value)) {
    throw new TypeError(name + "_invalid");
  }
  return value.toLowerCase();
}
function quantity(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(name + "_invalid");
  return BigInt(value);
}
function money(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(name + "_invalid");
  return BigInt(value);
}
function safeNumber(value, name) {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(-Number.MAX_SAFE_INTEGER)) {
    throw new RangeError(name + "_overflow");
  }
  return Number(value);
}
function proposeCycleCountAdjustment({
  organizationId, item, count, reservations, policy, reason, idempotencyKey, countedBy,
  reviewedBy = null
}) {
  const tenant = uuid(organizationId, "organization_id");
  if (!item || !count || !reservations || !policy) throw new TypeError("stock_evidence_required");
  const itemId = uuid(item.id, "inventory_item_id");
  if (uuid(item.organizationId, "item_organization_id") !== tenant ||
      uuid(count.organizationId, "count_organization_id") !== tenant) {
    throw new TypeError("organization_mismatch");
  }
  if (uuid(count.itemId, "count_inventory_item_id") !== itemId) {
    throw new TypeError("count_item_mismatch");
  }
  const actor = uuid(countedBy, "counted_by");
  const reviewer = reviewedBy == null ? null : uuid(reviewedBy, "reviewed_by");
  if (reviewer != null && actor === reviewer) throw new TypeError("self_approval_not_allowed");
  if (typeof idempotencyKey !== "string" || !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) {
    throw new TypeError("idempotency_key_invalid");
  }
  if (!REASONS.has(reason)) throw new TypeError("reason_invalid");
  if (item.status !== "active") throw new TypeError("item_not_active");
  if (typeof item.stockVersion !== "number" || !Number.isSafeInteger(item.stockVersion) ||
      item.stockVersion < 0) throw new RangeError("stock_version_invalid");
  if (count.snapshotVersion !== item.stockVersion) throw new TypeError("stale_inventory_snapshot");
  const baseUnit = units(item.unit, "item_unit");
  if (units(count.unit, "count_unit") !== baseUnit) throw new TypeError("unit_mismatch");
  const before = quantity(item.onHandMilli, "on_hand_milli");
  const physicallyCounted = quantity(count.physicalCountMilli, "physical_count_milli");
  const reserved = quantity(reservations.heldMilli, "held_milli");
  if (uuid(reservations.organizationId, "reservation_organization_id") !== tenant ||
      uuid(reservations.itemId, "reservation_inventory_item_id") !== itemId) {
    throw new TypeError("reservation_scope_mismatch");
  }
  // The contract uses fixed thousandths, and never silently rounds a
  // fractional unit from a barcode reader or mobile point of sale.
  const unitCost = money(item.unitCostCents, "unit_cost_cents");
  const maxAutoReview = money(policy.dualApprovalValueCents, "dual_approval_value_cents");
  const maxSingleDelta = quantity(policy.dualApprovalQuantityMilli, "dual_approval_quantity_milli");
  if (uuid(policy.organizationId, "policy_organization_id") !== tenant) {
    throw new TypeError("policy_scope_mismatch");
  }
  // No physical adjustment may make existing held/reserved commitments
  // impossible. If outstanding work is greater than on-hand, the stock must
  // be reconciled by an owner using explicit reservation exception handling.
  const delta = physicallyCounted - before;
  const absoluteDelta = delta < 0n ? -delta : delta;
  const amountCents = (absoluteDelta * unitCost + 500n) / 1000n;
  const reasons = [];
  if (reserved > before) reasons.push("reservation_exceeds_on_hand");
  if (physicallyCounted < reserved) reasons.push("count_below_existing_holds");
  if (reason === "damaged" || reason === "expired" || reason === "shrinkage") {
    reasons.push("quarantine_or_loss_review_required");
  }
  if (absoluteDelta > maxSingleDelta || amountCents > maxAutoReview) {
    reasons.push("dual_approval_required");
  }
  if (reviewer == null) reasons.push("second_reviewer_not_recorded");
  // Approval actor IDs are untrusted model inputs. Even two *different* IDs
  // do not certify role/permission/signature or a persisted decision.
  const unchanged = delta === 0n;
  const status = unchanged ? "no_change" :
    reasons.some(x => x === "reservation_exceeds_on_hand" || x === "count_below_existing_holds") ?
      "blocked" : "hold_for_review";
  return Object.freeze({
    organizationId: tenant,
    inventoryItemId: itemId,
    stockVersion: item.stockVersion,
    idempotencyKey,
    reason,
    unit: baseUnit,
    countedBy: actor,
    reviewedBy: reviewer,
    beforeMilli: safeNumber(before, "before"),
    countedMilli: safeNumber(physicallyCounted, "counted"),
    heldMilli: safeNumber(reserved, "held"),
    deltaMilli: safeNumber(delta, "delta"),
    absoluteAdjustmentValueCents: safeNumber(amountCents, "adjustment_value"),
    status,
    issues: Object.freeze([...new Set(reasons)]),
    effect: "proposal_only",
    authorizesStockMutation: false,
    requiresFreshServerRecalculation: true,
    requiresTrustedApproverAuthorization: true
  });
}
module.exports = Object.freeze({ proposeCycleCountAdjustment });
