// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { createHash } = require("node:crypto");
const {
  createExecutionEnvelope,
  buildPlatformEvent
} = require("./sonara-platform-kernel.cjs");

const GROUNDED_RETRIEVAL_VERSION = "1.0.0";
const RETRIEVAL_MODES = Object.freeze(["retrieve_only", "grounded_answer"]);
const SOURCE_TYPES = Object.freeze(["record", "asset", "document", "event", "knowledge"]);
const DEFAULT_MAX_RESULTS = 12;
const MAX_RESULTS = 50;

function requiredString(value, field) {
  const text = String(value == null ? "" : value).trim();
  if (!text) throw new TypeError(`${field} is required`);
  return text;
}

function positiveInteger(value, field, max) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > max) {
    throw new TypeError(`${field} must be an integer from 1 to ${max}`);
  }
  return number;
}

function normalizeMode(value) {
  const mode = requiredString(value || "grounded_answer", "mode");
  if (!RETRIEVAL_MODES.includes(mode)) throw new TypeError("mode is invalid");
  return mode;
}

function normalizeSourceTypes(value) {
  const requested = value == null ? SOURCE_TYPES : value;
  if (!Array.isArray(requested) || requested.length === 0) {
    throw new TypeError("sourceTypes must contain at least one source type");
  }
  const normalized = [...new Set(requested.map((item) => requiredString(item, "sourceType")))];
  for (const sourceType of normalized) {
    if (!SOURCE_TYPES.includes(sourceType)) throw new TypeError(`unsupported source type: ${sourceType}`);
  }
  return Object.freeze(normalized);
}

function fingerprint(text) {
  return createHash("sha256").update(String(text), "utf8").digest("hex");
}

function createGroundedRetrievalRequest(input = {}) {
  const query = requiredString(input.query, "query");
  const mode = normalizeMode(input.mode);
  const maxResults = positiveInteger(input.maxResults || DEFAULT_MAX_RESULTS, "maxResults", MAX_RESULTS);
  const sourceTypes = normalizeSourceTypes(input.sourceTypes);
  const idempotencyKey = requiredString(input.idempotencyKey, "idempotencyKey");
  const queryFingerprint = fingerprint(query);

  const envelope = createExecutionEnvelope({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    workflowKey: input.workflowKey || "grounded_retrieval",
    actionType: input.actionType || "summarise_records",
    idempotencyKey,
    correlationId: input.correlationId || idempotencyKey,
    connectorKey: input.connectorKey,
    resourceType: "retrieval_query",
    resourceId: queryFingerprint,
    metadata: {
      contract: GROUNDED_RETRIEVAL_VERSION,
      mode,
      maxResults,
      sourceTypes
    }
  });

  return Object.freeze({
    contractVersion: GROUNDED_RETRIEVAL_VERSION,
    envelope,
    organizationId: envelope.organizationId,
    actorUserId: envelope.actorUserId,
    query,
    queryFingerprint,
    mode,
    maxResults,
    sourceTypes,
    citationRequired: mode === "grounded_answer"
  });
}

function normalizeSources(request, sources) {
  if (!Array.isArray(sources)) throw new TypeError("sources must be an array");
  const seen = new Set();
  return sources.map((source, index) => {
    const sourceId = requiredString(source?.sourceId, `sources[${index}].sourceId`);
    const organizationId = requiredString(source?.organizationId, `sources[${index}].organizationId`);
    const sourceType = requiredString(source?.sourceType, `sources[${index}].sourceType`);
    if (organizationId !== request.organizationId) {
      throw new Error(`cross-tenant retrieval source rejected: ${sourceId}`);
    }
    if (!request.sourceTypes.includes(sourceType)) {
      throw new Error(`source type is outside the retrieval request: ${sourceType}`);
    }
    if (seen.has(sourceId)) throw new Error(`duplicate retrieval source: ${sourceId}`);
    seen.add(sourceId);
    return Object.freeze({ sourceId, organizationId, sourceType });
  });
}

function normalizeClaims(claims) {
  if (!Array.isArray(claims)) throw new TypeError("claims must be an array");
  const seen = new Set();
  return claims.map((claim, index) => {
    const claimId = requiredString(claim?.claimId, `claims[${index}].claimId`);
    if (seen.has(claimId)) throw new Error(`duplicate claim: ${claimId}`);
    seen.add(claimId);
    return Object.freeze({ claimId });
  });
}

function normalizeCitations(citations, claimIds, sourceIds) {
  if (!Array.isArray(citations)) throw new TypeError("citations must be an array");
  return citations.map((citation, index) => {
    const claimId = requiredString(citation?.claimId, `citations[${index}].claimId`);
    const sourceId = requiredString(citation?.sourceId, `citations[${index}].sourceId`);
    if (!claimIds.has(claimId)) throw new Error(`citation references unknown claim: ${claimId}`);
    if (!sourceIds.has(sourceId)) throw new Error(`citation references unknown source: ${sourceId}`);
    return Object.freeze({ claimId, sourceId });
  });
}

function evaluateGroundedResult({ request, sources = [], claims = [], citations = [] } = {}) {
  if (!request || request.contractVersion !== GROUNDED_RETRIEVAL_VERSION) {
    throw new TypeError("a grounded retrieval request is required");
  }

  const normalizedSources = normalizeSources(request, sources);
  const normalizedClaims = normalizeClaims(claims);
  const sourceIds = new Set(normalizedSources.map((source) => source.sourceId));
  const claimIds = new Set(normalizedClaims.map((claim) => claim.claimId));
  const normalizedCitations = normalizeCitations(citations, claimIds, sourceIds);
  const citedClaims = new Set(normalizedCitations.map((citation) => citation.claimId));
  const citationCoverage = normalizedClaims.length === 0 ? 0 : citedClaims.size / normalizedClaims.length;

  const ready = request.mode === "retrieve_only"
    ? normalizedSources.length > 0
    : normalizedSources.length > 0 && normalizedClaims.length > 0 && citationCoverage === 1;

  return Object.freeze({
    contractVersion: GROUNDED_RETRIEVAL_VERSION,
    ready,
    sourceCount: normalizedSources.length,
    claimCount: normalizedClaims.length,
    citationCount: normalizedCitations.length,
    citedClaimCount: citedClaims.size,
    citationCoverage,
    sourceIds: Object.freeze([...sourceIds]),
    citedClaimIds: Object.freeze([...citedClaims])
  });
}

function buildGroundingEvidenceEvent(request, evaluation) {
  if (!request || request.contractVersion !== GROUNDED_RETRIEVAL_VERSION) {
    throw new TypeError("a grounded retrieval request is required");
  }
  if (!evaluation || evaluation.contractVersion !== GROUNDED_RETRIEVAL_VERSION) {
    throw new TypeError("a grounding evaluation is required");
  }

  return buildPlatformEvent(request.envelope, "retrieval.evaluated", {
    metadata: {
      contract: GROUNDED_RETRIEVAL_VERSION,
      queryFingerprint: request.queryFingerprint,
      mode: request.mode,
      ready: evaluation.ready,
      sourceCount: evaluation.sourceCount,
      claimCount: evaluation.claimCount,
      citationCount: evaluation.citationCount,
      citationCoverage: evaluation.citationCoverage
    }
  });
}

module.exports = {
  GROUNDED_RETRIEVAL_VERSION,
  RETRIEVAL_MODES,
  SOURCE_TYPES,
  DEFAULT_MAX_RESULTS,
  MAX_RESULTS,
  createGroundedRetrievalRequest,
  evaluateGroundedResult,
  buildGroundingEvidenceEvent,
  fingerprint
};
