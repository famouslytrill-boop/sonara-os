// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert = require("node:assert/strict");
const { evaluateCustomerCohort } = require("../lib/sonara-customer-cohort-proof.cjs");

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";
const OUTSIDER = "44444444-4444-4444-8444-444444444444";
const from = "2026-09-01T00:00:00.000Z";
const to = "2026-09-02T00:00:00.000Z";
const asOf = "2026-09-15T00:00:00.000Z";
const source = { authorized: true, organizationsComplete: true, activityEventsComplete: true };
function org(id, created_at = "2026-09-01T10:00:00.000Z", eligible = true) { return { id, created_at, eligible }; }
function event(organization_id, event_type, created_at) { return { organization_id, event_type, created_at }; }
function run(organizations = [], activityEvents = [], overrides = {}) {
  return evaluateCustomerCohort({ from, to, asOf, source, organizations, activityEvents, ...overrides });
}

describe("customer cohort proof", () => {
  it("fails closed on unauthenticated, partial, or invalid windows", () => {
    assert.equal(evaluateCustomerCohort({ organizations: [], activityEvents: [], from, to, asOf }).code, "source_evidence_incomplete");
    assert.equal(run([], [], { source: { ...source, activityEventsComplete: false } }).code, "source_evidence_incomplete");
    assert.equal(run([], [], { asOf: from }).code, "observation_window_invalid");
    assert.equal(run([], [], { from: "2026-02-30T00:00:00.000Z" }).code, "observation_window_invalid");
  });

  it("does not invent a rate when an eligible denominator is empty", () => {
    const { ok, report } = run([org(C, undefined, false)], []);
    assert.equal(ok, true);
    assert.equal(report.eligibleOrganizations, 0);
    assert.equal(report.activationRate, null);
    assert.equal(report.firstValueRate, null);
    assert.equal(report.day7RetentionRate, null);
    assert.equal(report.verifiedPaidConversionRate, null);
  });

  it("deduplicates organizations and events while keeping measured purchase separate from verified billing", () => {
    const events = [
      event(A, "account.organization_created", "2026-09-01T10:00:00.000Z"),
      event(A, "account.organization_created", "2026-09-01T10:00:00.000Z"),
      event(A, "creator_studio.output_downloaded", "2026-09-01T10:12:00.000Z"),
      event(A, "billing.purchase_completed", "2026-09-01T10:13:00.000Z"),
      event(A, "business_builder.intake_created", "2026-09-08T12:00:00.000Z"),
      event(B, "account.organization_created", "2026-09-01T10:00:00.000Z"),
      event(C, "account.organization_created", "2026-09-01T10:00:00.000Z"),
      event(OUTSIDER, "account.organization_created", "2026-09-01T10:00:00.000Z"),
      event(OUTSIDER, "creator_studio.output_downloaded", "2026-09-01T10:01:00.000Z")
    ];
    const result = run([org(A), org(B), org(C, undefined, false)], events);
    assert.equal(result.ok, true);
    assert.deepEqual({ eligible: result.report.eligibleOrganizations, activated: result.report.activatedOrganizations,
      value: result.report.firstValueOrganizations, purchaseEvent: result.report.observedPurchaseEventOrganizations,
      retained: result.report.day7RetainedOrganizations, mature: result.report.matureActivatedOrganizations },
      { eligible: 2, activated: 2, value: 1, purchaseEvent: 1, retained: 1, mature: 2 });
    assert.equal(result.report.firstValueRate, 0.5);
    assert.equal(result.report.day7RetentionRate, 0.5);
    assert.equal(result.report.medianTimeToFirstValueSeconds, 720);
    assert.equal(result.report.verifiedPaidConversionRate, null);
    assert.equal(JSON.stringify(result).includes(A), false, "aggregate output must not leak tenant IDs");
  });

  it("does not count pre-activation and future events or billing events as day-7 product retention", () => {
    const result = run([org(A)], [
      event(A, "creator_studio.output_downloaded", "2026-09-01T10:00:00.000Z"),
      event(A, "account.organization_created", "2026-09-01T10:05:00.000Z"),
      event(A, "billing.purchase_completed", "2026-09-08T13:00:00.000Z"),
      event(A, "creator_studio.output_downloaded", "2026-09-16T00:00:00.000Z")
    ]);
    assert.equal(result.report.firstValueOrganizations, 0);
    assert.equal(result.report.day7RetainedOrganizations, 0);
    assert.equal(result.report.observedPurchaseEventOrganizations, 1);
  });

  it("excludes incomplete day-7 windows from the retention denominator", () => {
    const result = run([org(A)], [event(A, "account.organization_created", "2026-09-01T10:00:00.000Z")],
      { asOf: "2026-09-08T10:00:00.000Z" });
    assert.equal(result.report.activatedOrganizations, 1);
    assert.equal(result.report.matureActivatedOrganizations, 0);
    assert.equal(result.report.day7RetentionRate, null);
  });

  it("rejects bad tenant scope, duplicate authoritative organizations, and malformed relevant events", () => {
    assert.equal(run([org(A), org(A)], []).code, "organization_evidence_invalid");
    assert.equal(run([org(A)], [event("bad", "account.organization_created", asOf)]).code, "activity_scope_invalid");
    assert.equal(run([org(A)], [event(A, "account.organization_created", "not a date")]).code, "activity_evidence_invalid");
    assert.equal(run([org(A, "2026-09-01T10:00:00.000Z", null)], []).code, "organization_evidence_invalid");
  });

  it("supports PostgreSQL timezone offsets without accepting impossible dates", () => {
    const result = run([org(A, "2026-09-01T06:00:00-04:00")],
      [event(A, "account.organization_created", "2026-09-01T06:00:00-04:00")]);
    assert.equal(result.ok, true);
    assert.equal(result.report.activatedOrganizations, 1);
    assert.equal(run([org(A, "2026-09-31T10:00:00.000Z")], []).ok, false);
  });

  it("reports D30 and D60 mature product activity without confusing billing events with retention", () => {
    const observed = "2026-08-02T00:00:00.000Z";
    const created = "2026-06-01T10:00:00.000Z";
    const result = run([org(A, created), org(B, created)], [
      event(A, "account.organization_created", created),
      event(B, "account.organization_created", created),
      event(A, "business_builder.intake_created", "2026-07-01T11:00:00.000Z"),
      event(A, "business_builder.intake_created", "2026-07-31T11:00:00.000Z"),
      event(B, "billing.purchase_completed", "2026-07-31T12:00:00.000Z"),
      event(B, "business_builder.intake_created", "2026-08-01T11:00:00.000Z")
    ], { from: "2026-06-01T00:00:00.000Z", to: "2026-06-02T00:00:00.000Z", asOf: observed });
    assert.equal(result.ok, true);
    assert.equal(result.report.matureDay30ActivatedOrganizations, 2);
    assert.equal(result.report.day30RetainedOrganizations, 1);
    assert.equal(result.report.day30ProductActivityRetentionRate, 0.5);
    assert.equal(result.report.matureDay60ActivatedOrganizations, 2);
    assert.equal(result.report.day60RetainedOrganizations, 1);
    assert.equal(result.report.day60ProductActivityRetentionRate, 0.5);
    assert.equal(result.report.verifiedDay60PayingCustomerRetentionRate, null);
    assert.equal(result.report.paidEvidenceStatus, "provider_reconciliation_required");
  });

  it("withholds D60 rates until every eligible D60 observation window is complete", () => {
    const created = "2026-06-01T10:00:00.000Z";
    const result = run([org(A, created)], [
      event(A, "account.organization_created", created),
      event(A, "business_builder.intake_created", "2026-07-31T11:00:00.000Z")
    ], { from: "2026-06-01T00:00:00.000Z", to: "2026-06-02T00:00:00.000Z",
      asOf: "2026-07-31T12:00:00.000Z" });
    assert.equal(result.ok, true);
    assert.equal(result.report.matureDay60ActivatedOrganizations, 0);
    assert.equal(result.report.day60RetainedOrganizations, 0);
    assert.equal(result.report.day60ProductActivityRetentionRate, null);
    assert.equal(result.report.matureDay30ActivatedOrganizations, 1);
    assert.equal(result.report.day30ProductActivityRetentionRate, 0);
  });

});
