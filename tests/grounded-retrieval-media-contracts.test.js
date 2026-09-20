"use strict";

const assert = require("node:assert/strict");
const {
  createGroundedRetrievalRequest,
  evaluateGroundedResult,
  buildGroundingEvidenceEvent
} = require("../lib/sonara-grounded-retrieval-contract.cjs");
const {
  createMediaProcessingPlan,
  buildMediaProcessingEvidenceEvent
} = require("../lib/sonara-media-processing-contract.cjs");

const baseRetrieval = {
  organizationId: "org-1",
  actorUserId: "user-1",
  query: "Which open customer tasks are overdue?",
  idempotencyKey: "retrieve-1",
  correlationId: "corr-1",
  sourceTypes: ["record", "document"]
};

describe("grounded retrieval contract", () => {
  it("reuses the platform kernel and keeps a grounded answer self-serve and citation-required", () => {
    const request = createGroundedRetrievalRequest(baseRetrieval);
    assert.equal(request.envelope.organizationId, "org-1");
    assert.equal(request.envelope.actorUserId, "user-1");
    assert.equal(request.envelope.actionType, "summarise_records");
    assert.equal(request.envelope.requiresOwnerApproval, false);
    assert.equal(request.citationRequired, true);
    assert.equal(request.queryFingerprint.length, 64);
  });

  it("rejects a source from another organization", () => {
    const request = createGroundedRetrievalRequest(baseRetrieval);
    assert.throws(
      () => evaluateGroundedResult({
        request,
        sources: [{ sourceId: "record-1", organizationId: "org-2", sourceType: "record" }]
      }),
      /cross-tenant retrieval source rejected/
    );
  });

  it("requires every grounded-answer claim to be backed by a known source", () => {
    const request = createGroundedRetrievalRequest(baseRetrieval);
    const sources = [
      { sourceId: "record-1", organizationId: "org-1", sourceType: "record" },
      { sourceId: "doc-1", organizationId: "org-1", sourceType: "document" }
    ];
    const claims = [{ claimId: "claim-1" }, { claimId: "claim-2" }];

    const partial = evaluateGroundedResult({
      request,
      sources,
      claims,
      citations: [{ claimId: "claim-1", sourceId: "record-1" }]
    });
    assert.equal(partial.ready, false);
    assert.equal(partial.citationCoverage, 0.5);

    const complete = evaluateGroundedResult({
      request,
      sources,
      claims,
      citations: [
        { claimId: "claim-1", sourceId: "record-1" },
        { claimId: "claim-2", sourceId: "doc-1" }
      ]
    });
    assert.equal(complete.ready, true);
    assert.equal(complete.citationCoverage, 1);
  });

  it("emits compact evidence without copying the query or answer claims", () => {
    const request = createGroundedRetrievalRequest(baseRetrieval);
    const evaluation = evaluateGroundedResult({
      request,
      sources: [{ sourceId: "record-1", organizationId: "org-1", sourceType: "record" }],
      claims: [{ claimId: "claim-1" }],
      citations: [{ claimId: "claim-1", sourceId: "record-1" }]
    });
    const event = buildGroundingEvidenceEvent(request, evaluation);
    const serialized = JSON.stringify(event);
    assert.equal(event.organization_id, "org-1");
    assert.equal(event.event_name, "retrieval.evaluated");
    assert.equal(event.metadata.citationCoverage, 1);
    assert.equal(serialized.includes(baseRetrieval.query), false);
    assert.equal(serialized.includes("claim-1"), false);
  });
});

describe("isolated media processing contract", () => {
  const baseMedia = {
    organizationId: "org-1",
    actorUserId: "user-1",
    operation: "transcode_preview",
    inputAssetId: "asset-in",
    outputAssetId: "asset-out",
    sourceStorageKey: "org-1/assets/input.mov",
    outputStorageKey: "org-1/previews/output.mp4",
    contentType: "video/quicktime",
    inputBytes: 25 * 1024 * 1024,
    idempotencyKey: "media-1"
  };

  it("builds a private preview plan with no network, provider, publish, or destructive authority", () => {
    const plan = createMediaProcessingPlan(baseMedia);
    assert.equal(plan.envelope.requiresOwnerApproval, false);
    assert.equal(plan.input.mount, "read_only");
    assert.equal(plan.output.visibility, "private");
    assert.equal(plan.output.lifecycle, "preview");
    assert.equal(plan.isolation.networkAccess, false);
    assert.equal(plan.isolation.externalProviderCalls, false);
    assert.equal(plan.isolation.publishAllowed, false);
    assert.equal(plan.isolation.destructiveWritesAllowed, false);
    assert.equal(plan.isolation.workerActivation, "disabled_by_default");
  });

  it("refuses in-place overwrites and inputs over the configured limit", () => {
    assert.throws(
      () => createMediaProcessingPlan({ ...baseMedia, outputAssetId: "asset-in" }),
      /new output asset/
    );
    assert.throws(
      () => createMediaProcessingPlan({ ...baseMedia, inputBytes: 11, maxInputBytes: 10 }),
      /exceeds the configured processing limit/
    );
  });

  it("enforces operation/media-family compatibility", () => {
    assert.throws(
      () => createMediaProcessingPlan({ ...baseMedia, operation: "waveform_preview" }),
      /requires audio input/
    );
  });

  it("emits media completion evidence without granting publication authority", () => {
    const plan = createMediaProcessingPlan(baseMedia);
    const event = buildMediaProcessingEvidenceEvent(plan, { status: "succeeded" });
    assert.equal(event.organization_id, "org-1");
    assert.equal(event.event_name, "media.preview.completed");
    assert.equal(event.metadata.outputVisibility, "private");
    assert.equal(plan.isolation.publishAllowed, false);
  });
});
