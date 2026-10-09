// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert = require("node:assert/strict");
const { rankOperationalAlternatives, assessCommunication } = require("../lib/sonara-operational-decision-policy.cjs");
const NOW = "2026-10-09T16:00:00Z";
const proof = { organizationId: "org1", authorized: true, complete: true, truncated: false,
  sourceRevision: "verified-v1", readAtUtc: "2026-10-09T15:59:30Z" };
const weights = { cost: 2500, duration: 2500, risk: 2500, quality: 2500 };
const limits = { maxCostCents: 10000, maxDurationMinutes: 90,
  maxRiskBasisPoints: 2000, minQualityBasisPoints: 6000 };
const option = (key, overrides = {}) => ({ key, organizationId: "org1",
  measurementVerified: true, measurementSource: "manager_verified_20261009",
  metrics: { costCents: 1000, durationMinutes: 30, riskBasisPoints: 100, qualityBasisPoints: 8500 },
  ...overrides });
const ranking = (overrides = {}) => rankOperationalAlternatives({
  organizationId: "org1", domain: "restaurant", evidence: proof,
  nowUtc: NOW, limits, weights, alternatives: [option("a"), option("b", {
    metrics: { costCents: 5000, durationMinutes: 50, riskBasisPoints: 1000, qualityBasisPoints: 7000 }
  })], ...overrides
});
const recipient = {
  id: "r1", organizationId: "org1", suppressed: false, consentComplete: true,
  grants: [{ organizationId: "org1", recipientId: "r1", channel: "email",
    purpose: "transactional", active: true, verified: true }]
};
const comm = (overrides = {}) => assessCommunication({
  organizationId: "org1", evidence: proof, nowUtc: NOW, recipient,
  channel: "email", purpose: "transactional", intentKey: "booking-confirm-123",
  quietHours: { timeZone: "America/New_York", startMinute: 22 * 60, endMinute: 8 * 60 },
  cooldownMinutes: 15, lastSentAtUtc: null, ...overrides
});

describe("cross-suite evidence-gated decision and communication previews", () => {
  it("ranks feasible operator alternatives deterministically without executing", () => {
    const r = ranking();
    assert.equal(r.ok, true);
    assert.equal(r.recommendedKey, "a");
    assert.deepEqual(r.ranked.map(x => x.key), ["a", "b"]);
    assert.equal(r.mayExecute, false);
    assert.equal(r.ownerApprovalRequired, true);
    assert.deepEqual(r, ranking());
  });
  it("breaks ties using stable exact keys", () => {
    const r = ranking({ alternatives: [option("z"), option("a")] });
    assert.deepEqual(r.ranked.map(x => x.key), ["a", "z"]);
  });
  it("hard constraints remove infeasible options rather than lowering their score", () => {
    const r = ranking({ alternatives: [option("expensive", {
      metrics: { costCents: 10001, durationMinutes: 30, riskBasisPoints: 100, qualityBasisPoints: 8500 }
    }), option("safe")] });
    assert.deepEqual(r.excluded.map(x => x.key), ["expensive"]);
    assert.equal(r.recommendedKey, "safe");
  });
  it("returns no feasible option rather than manufacturing an answer", () => {
    const r = ranking({ alternatives: [option("expensive", {
      metrics: { costCents: 20000, durationMinutes: 90, riskBasisPoints: 2000, qualityBasisPoints: 8500 }
    })] });
    assert.equal(r.ok, true);
    assert.equal(r.status, "no_feasible_option");
    assert.equal(r.recommendedKey, null);
  });
  it("rejects stale, partial, unscoped and spoofed source evidence", () => {
    for (const change of [
      { authorized: false }, { truncated: true }, { complete: false },
      { organizationId: "org2" }, { sourceRevision: "" }
    ]) assert.equal(ranking({ evidence: { ...proof, ...change } }).code, "decision_evidence_unverified");
    assert.equal(ranking({ nowUtc: "2026-10-09T16:10:00Z" }).code, "decision_evidence_unverified");
  });
  it("rejects cross-tenant, guessed, duplicate or incomplete alternatives", () => {
    assert.equal(ranking({ alternatives: [option("x", { organizationId: "org2" })] }).code,
      "unverified_decision_alternative");
    assert.equal(ranking({ alternatives: [option("x", { measurementVerified: false })] }).code,
      "unverified_decision_alternative");
    assert.equal(ranking({ alternatives: [option("x"), option("x")] }).code,
      "unverified_decision_alternative");
    assert.equal(ranking({ alternatives: [option("x", { metrics: { costCents: 0 } })] }).code,
      "unverified_decision_alternative");
  });
  it("rejects nonsensical weights and does not score employment or medical decisions", () => {
    assert.equal(ranking({ weights: { ...weights, cost: 9999 } }).code, "invalid_decision_weights");
    assert.equal(ranking({ domain: "employment" }).code, "specialist_human_decision_required");
    assert.equal(ranking({ domain: "medical" }).code, "specialist_human_decision_required");
  });
  it("does not treat missing metrics as zero or negative costs as useful savings", () => {
    assert.equal(ranking({ alternatives: [option("x", {
      metrics: { costCents: -1, durationMinutes: 5, riskBasisPoints: 2, qualityBasisPoints: 9000 }
    })] }).code, "unverified_decision_alternative");
  });
  it("allows a reviewed message intent without claiming delivery", () => {
    const c = comm();
    assert.equal(c.ok, true);
    assert.equal(c.status, "awaiting_owner_approval");
    assert.equal(c.mayExecute, false);
    assert.equal(c.ownerApprovalRequired, true);
    assert.equal(c.consentVerifiedForRequestedScope, true);
  });
  it("never infers consent for marketing from transactional consent", () => {
    assert.equal(comm({ purpose: "marketing" }).code, "consent_not_granted");
    assert.equal(comm({ channel: "sms" }).code, "consent_not_granted");
  });
  it("rejects suppression, unverified, wrong-tenant or stale grant", () => {
    assert.equal(comm({ recipient: { ...recipient, suppressed: true } }).code,
      "recipient_consent_or_scope_unverified");
    assert.equal(comm({ recipient: { ...recipient, organizationId: "org2" } }).code,
      "recipient_consent_or_scope_unverified");
    assert.equal(comm({ recipient: { ...recipient, grants: [{
      ...recipient.grants[0], organizationId: "org2"
    }] } }).code, "invalid_consent_evidence");
    assert.equal(comm({ recipient: { ...recipient, grants: [{
      ...recipient.grants[0], active: false
    }] } }).code, "consent_not_granted");
  });
  it("enforces cross-midnight quiet hours in the actual recipient time zone", () => {
    const now = "2026-10-10T03:00:00Z"; // Friday 23:00 in New York
    const c = comm({ nowUtc: now,
      evidence: { ...proof, readAtUtc: "2026-10-10T02:59:50Z" } });
    assert.equal(c.code, "recipient_quiet_hours");
  });
  it("treats equal quiet-hour boundaries as all-day quiet rather than never quiet", () => {
    assert.equal(comm({ quietHours: { timeZone: "UTC", startMinute: 0, endMinute: 0 } }).code,
      "recipient_quiet_hours");
  });
  it("blocks cooldown, future last-send claims and invalid zone configurations", () => {
    assert.equal(comm({ lastSentAtUtc: "2026-10-09T15:55:00Z" }).code, "message_cooldown_active");
    assert.equal(comm({ lastSentAtUtc: "2026-10-09T16:02:00Z" }).code,
      "last_delivery_timestamp_unverified");
    assert.equal(comm({ quietHours: { timeZone: "Pluto/Olympus", startMinute: 1, endMinute: 10 } }).code,
      "invalid_recipient_time_zone");
  });
  it("rejects incomplete communication evidence and invalid intent keys", () => {
    assert.equal(comm({ evidence: { ...proof, truncated: true } }).code,
      "communication_evidence_unverified");
    assert.equal(comm({ intentKey: "contains secrets or spaces" }).code,
      "invalid_message_intent");
  });
});
