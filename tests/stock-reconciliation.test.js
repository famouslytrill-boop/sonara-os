// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert = require("node:assert/strict");
const { proposeCycleCountAdjustment } = require("../lib/sonara-stock-reconciliation.cjs");
const ORG = "11111111-1111-4111-8111-111111111111";
const ITEM = "22222222-2222-4222-8222-222222222222";
const ACTOR = "33333333-3333-4333-8333-333333333333";
const REVIEWER = "44444444-4444-4444-8444-444444444444";
const FOREIGN = "55555555-5555-4555-8555-555555555555";
function fixture() {
  return {
    organizationId: ORG,
    item: {
      id: ITEM, organizationId: ORG, unit: "each", stockVersion: 7,
      status: "active", onHandMilli: 12000, unitCostCents: 300
    },
    count: {
      organizationId: ORG, itemId: ITEM, unit: "each",
      snapshotVersion: 7, physicalCountMilli: 11000
    },
    reservations: { organizationId: ORG, itemId: ITEM, heldMilli: 8000 },
    policy: {
      organizationId: ORG, dualApprovalValueCents: 5000,
      dualApprovalQuantityMilli: 5000
    },
    reason: "cycle_count", idempotencyKey: "stock-count:123456",
    countedBy: ACTOR, reviewedBy: REVIEWER
  };
}
describe("Producer/distributor/retailer stock reconciliation preflight", () => {
  it("proposes an exact, auditable negative correction without posting it", () => {
    const p = proposeCycleCountAdjustment(fixture());
    assert.equal(p.deltaMilli, -1000);
    assert.equal(p.absoluteAdjustmentValueCents, 300);
    assert.equal(p.beforeMilli, 12000);
    assert.equal(p.countedMilli, 11000);
    assert.equal(p.heldMilli, 8000);
    assert.equal(p.status, "hold_for_review");
    assert.equal(p.effect, "proposal_only");
    assert.equal(p.authorizesStockMutation, false);
    assert.equal(p.requiresTrustedApproverAuthorization, true);
    assert.ok(Object.isFrozen(p));
    assert.ok(Object.isFrozen(p.issues));
  });
  it("marks an exactly reconciled count as no_change", () => {
    const p=fixture();p.count.physicalCountMilli=12000;
    assert.equal(proposeCycleCountAdjustment(p).status, "no_change");
    assert.equal(proposeCycleCountAdjustment(p).deltaMilli, 0);
  });
  it("blocks corrections that would consume other customers' held inventory", () => {
    const p=fixture();p.count.physicalCountMilli=7000;
    const result=proposeCycleCountAdjustment(p);
    assert.equal(result.status,"blocked");
    assert.ok(result.issues.includes("count_below_existing_holds"));
  });
  it("does not hide reservation corruption behind an unchanged count", () => {
    const p=fixture();p.count.physicalCountMilli=12000;p.reservations.heldMilli=13000;
    const r=proposeCycleCountAdjustment(p);
    assert.equal(r.deltaMilli,0);
    assert.equal(r.status,"blocked");
    assert.ok(r.issues.includes("reservation_exceeds_on_hand"));
  });
  it("blocks adjusting stock that already has more holds than on-hand", () => {
    const p=fixture();p.reservations.heldMilli=13000;
    const result=proposeCycleCountAdjustment(p);
    assert.equal(result.status,"blocked");
    assert.ok(result.issues.includes("reservation_exceeds_on_hand"));
  });
  it("requires dual approval for material percentage or monetary threshold crossings", () => {
    const p=fixture();p.count.physicalCountMilli=5000;
    const r=proposeCycleCountAdjustment(p);
    assert.ok(r.issues.includes("dual_approval_required"));
    const q=fixture();q.policy.dualApprovalValueCents=100;
    assert.ok(proposeCycleCountAdjustment(q).issues.includes("dual_approval_required"));
  });
  it("treats damage, expiry and shrinkage as exceptional custody workflows", () => {
    for(const reason of ["damaged","expired","shrinkage"]){
      const p=fixture();p.reason=reason;
      const result=proposeCycleCountAdjustment(p);
      assert.ok(result.issues.includes("quarantine_or_loss_review_required"));
      assert.equal(result.effect,"proposal_only");
    }
  });
  it("requires custody review when a damaged or expired lot counts exactly", () => {
    for (const reason of ["damaged", "expired", "shrinkage"]) {
      const p=fixture();p.count.physicalCountMilli=12000;p.reason=reason;
      const result=proposeCycleCountAdjustment(p);
      assert.equal(result.status, "hold_for_review");
      assert.ok(result.issues.includes("quarantine_or_loss_review_required"));
    }
  });
  it("does not allow a single actor to self-approve, including case changes", () => {
    const p=fixture();p.reviewedBy=ACTOR.toUpperCase();
    assert.throws(()=>proposeCycleCountAdjustment(p),/self_approval_not_allowed/);
  });
  it("identifies missing reviewer as an incomplete approval record", () => {
    const p=fixture();p.reviewedBy=null;
    const result=proposeCycleCountAdjustment(p);
    assert.ok(result.issues.includes("second_reviewer_not_recorded"));
    assert.equal(result.status,"hold_for_review");
  });
  it("refuses cross-tenant item, count, holds, and policy references", () => {
    for(const modify of [
      (p)=>p.item.organizationId=FOREIGN,
      (p)=>p.count.organizationId=FOREIGN,
      (p)=>p.reservations.organizationId=FOREIGN,
      (p)=>p.policy.organizationId=FOREIGN
    ]){
      const p=fixture();modify(p);
      assert.throws(()=>proposeCycleCountAdjustment(p),/(organization_mismatch|reservation_scope_mismatch|policy_scope_mismatch)/);
    }
  });
  it("rejects stale count snapshots and mismatched inventory item IDs or units", () => {
    const p=fixture();p.count.snapshotVersion=6;
    assert.throws(()=>proposeCycleCountAdjustment(p),/stale_inventory_snapshot/);
    p.count.snapshotVersion=7;p.count.itemId=FOREIGN;
    assert.throws(()=>proposeCycleCountAdjustment(p),/count_item_mismatch/);
    p.count.itemId=ITEM;p.count.unit="kg";
    assert.throws(()=>proposeCycleCountAdjustment(p),/unit_mismatch/);
  });
  it("rejects unsupported reasons, duplicate-request-shaped and unsafe inputs", () => {
    const p=fixture();p.reason="arbitrary_stock_in";
    assert.throws(()=>proposeCycleCountAdjustment(p),/reason_invalid/);
    p.reason="cycle_count";p.idempotencyKey="x";
    assert.throws(()=>proposeCycleCountAdjustment(p),/idempotency_key_invalid/);
    p.idempotencyKey="count:123456";p.count.physicalCountMilli=1.111;
    assert.throws(()=>proposeCycleCountAdjustment(p),/physical_count_milli_invalid/);
    p.count.physicalCountMilli=-1;
    assert.throws(()=>proposeCycleCountAdjustment(p),/physical_count_milli_invalid/);
  });
  it("uses integer monetary calculations and refuses value overflows", () => {
    const p=fixture();p.item.unitCostCents=Number.MAX_SAFE_INTEGER;
    p.count.physicalCountMilli=0;p.reservations.heldMilli=0;
    assert.throws(()=>proposeCycleCountAdjustment(p),/adjustment_value_overflow/);
  });
  it("does not invent a new item quantity without a valid persisted version", () => {
    const p=fixture();p.item.stockVersion=undefined;
    assert.throws(()=>proposeCycleCountAdjustment(p),/stock_version_invalid/);
    p.item.stockVersion=7;p.item.status="archived";
    assert.throws(()=>proposeCycleCountAdjustment(p),/item_not_active/);
  });
});
