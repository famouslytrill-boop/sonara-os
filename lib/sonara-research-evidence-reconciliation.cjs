// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Evidence triage is NOT publisher verification, a reviewer's signature,
// a licensed data feed, a ranking approval, or a network-fetch authorization.
const { planComparableTop50 } = require("./sonara-research-comparable-top50.cjs");
const { auditEvidencePacket } = require("./sonara-research-benchmark-gates.cjs");
const FIELDS = new Set(["entityId", "evidenceId", "sourceUrl", "stance", "observedAt"]);

function reconcileComparableEvidence({ comparison, receipts, maxAgeDays = 90 } = {}) {
  const plan = planComparableTop50(comparison);
  if (!Array.isArray(receipts) || receipts.length > 500) {
    throw new TypeError("receipts must be an array of at most 500 evidence records");
  }
  if (!Number.isInteger(maxAgeDays) || maxAgeDays < 0 || maxAgeDays > 365) {
    throw new RangeError("maxAgeDays must be between 0 and 365");
  }
  const observations = new Map(comparison.observations.map(row => [row.entityId, row.evidenceId]));
  const usedEvidenceIds = new Set();
  const reusedEvidenceIds = new Set();
  for (const evidenceId of observations.values()) {
    if (usedEvidenceIds.has(evidenceId)) reusedEvidenceIds.add(evidenceId);
    usedEvidenceIds.add(evidenceId);
  }
  const accepted = [];
  const rejectedIndices = [];
  for (let i = 0; i < receipts.length; i++) {
    const receipt = receipts[i];
    if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)
      || Object.keys(receipt).length !== FIELDS.size
      || Object.keys(receipt).some(key => !FIELDS.has(key))
      || !observations.has(receipt.entityId)
      || receipt.evidenceId !== observations.get(receipt.entityId)) {
      rejectedIndices.push(i);
      continue;
    }
    accepted.push({ claimId: receipt.entityId, sourceUrl: receipt.sourceUrl,
      stance: receipt.stance, observedAt: receipt.observedAt });
  }
  const packet = auditEvidencePacket({ observations: accepted,
    reviewedAt: comparison.reviewedAt, maxAgeDays });
  const claims = new Map(packet.claims.map(claim => [claim.claimId, claim]));
  let supportedMeasurements = 0;
  let contradictedMeasurements = 0;
  let staleMeasurements = 0;
  for (const entityId of observations.keys()) {
    const claim = claims.get(entityId);
    if (claim && claim.supports > 0) supportedMeasurements++;
    if (claim && claim.contradicts > 0) contradictedMeasurements++;
    if (claim && claim.staleSources > 0) staleMeasurements++;
  }
  const problems = Object.freeze([
    ...plan.blockers,
    ...packet.issueCodes,
    ...(rejectedIndices.length || packet.rejected.length ? ["invalid_or_unmatched_evidence_receipts"] : []),
    ...(supportedMeasurements < observations.size ? ["measurements_missing_supporting_receipts"] : []),
    ...(reusedEvidenceIds.size ? ["evidence_identifier_reused_across_entities"] : []),
    ...(plan.cutoffTieRequiresReview ? ["cutoff_tie_unresolved"] : []),
    "source_identity_and_reviewer_unverified",
    "rights_and_republication_approval_missing"
  ]);
  return Object.freeze({
    categoryId: plan.categoryId, metric: plan.metric, period: plan.period,
    unit: plan.unit, geography: plan.geography,
    observedMeasurements: observations.size,
    candidateCount: plan.candidateTop50.length,
    submittedReceipts: receipts.length, acceptedSourceReceipts: packet.acceptedEvidenceCount,
    malformedOrUnmatchedReceipts: rejectedIndices.length + packet.rejected.length,
    supportedMeasurements, unsupportedMeasurements: observations.size - supportedMeasurements,
    contradictedMeasurements, staleMeasurements,
    reusedEvidenceIdentifierCount: reusedEvidenceIds.size,
    sourcePacketStatus: packet.overallStatus,
    blockers: Object.freeze([...new Set(problems)]),
    provenanceModel: "claim_entity_source_activity_metadata_only",
    evidenceIndependentlyVerified: false, reviewerIdentityAuthenticated: false,
    publisherRightsVerified: false, allSourcesRetrieved: false,
    sourceDatesIndependentlyVerified: false, rankingVerified: false,
    automatedIngestionAllowed: false, customerDecisionAuthorized: false,
    publicationAuthorized: false, productionAuthorized: false,
    nextGate: "Independently retrieve source editions, resolve conflicting and missing evidence, authenticate reviewers, check rights and obtain release approval."
  });
}
module.exports = Object.freeze({ reconcileComparableEvidence });
