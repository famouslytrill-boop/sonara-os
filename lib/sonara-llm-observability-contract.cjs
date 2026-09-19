// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const crypto = require("node:crypto");

const OUTCOMES = Object.freeze(["ok", "error", "blocked", "needs_review"]);
const EVALUATION_FIELDS = Object.freeze([
  "relevanceScore",
  "groundednessScore",
  "hallucinationRiskScore",
  "policyViolationCount",
  "userSatisfactionScore"
]);

function createLlmObservation(input = {}) {
  const record = {
    version: 1,
    traceId: requiredString(input.traceId, "traceId"),
    spanId: requiredString(input.spanId, "spanId"),
    organizationId: requiredString(input.organizationId, "organizationId"),
    occurredAt: input.occurredAt || new Date().toISOString(),
    operation: requiredString(input.operation, "operation"),
    provider: requiredString(input.provider, "provider"),
    model: requiredString(input.model, "model"),
    outcome: OUTCOMES.includes(input.outcome) ? input.outcome : "ok",
    durationMs: nonNegativeNumber(input.durationMs),
    inputTokens: nonNegativeInteger(input.inputTokens),
    outputTokens: nonNegativeInteger(input.outputTokens),
    costMicros: nonNegativeInteger(input.costMicros),
    providerCalled: Boolean(input.providerCalled),
    promptFingerprint: fingerprint(input.promptTemplateId || input.promptFingerprint || "unknown"),
    sourceRefs: normalizeStrings(input.sourceRefs),
    evaluations: normalizeEvaluations(input.evaluations),
    errorCode: input.errorCode == null ? null : String(input.errorCode).slice(0, 120),
    rawPromptStored: false,
    rawResponseStored: false,
    secretMaterialStored: false,
    retentionClass: input.retentionClass === "security_audit" ? "security_audit" : "operational",
    tags: normalizeTags(input.tags)
  };

  const validation = validateLlmObservation(record);
  if (!validation.ok) {
    const error = new Error(`Invalid LLM observation: ${validation.errors.join("; ")}`);
    error.code = "SONARA_LLM_OBSERVATION_INVALID";
    throw error;
  }
  return Object.freeze(record);
}

function validateLlmObservation(record) {
  const errors = [];
  if (!record || typeof record !== "object" || Array.isArray(record)) return { ok: false, errors: ["record must be an object"] };
  for (const key of ["traceId", "spanId", "organizationId", "occurredAt", "operation", "provider", "model", "outcome", "promptFingerprint", "retentionClass"]) {
    if (typeof record[key] !== "string" || !record[key].trim()) errors.push(`${key} is required`);
  }
  if (!OUTCOMES.includes(record.outcome)) errors.push(`unsupported outcome: ${record.outcome}`);
  for (const key of ["durationMs", "inputTokens", "outputTokens", "costMicros"]) {
    if (typeof record[key] !== "number" || record[key] < 0 || !Number.isFinite(record[key])) errors.push(`${key} must be non-negative`);
  }
  if (record.rawPromptStored !== false || record.rawResponseStored !== false || record.secretMaterialStored !== false) {
    errors.push("raw prompts, raw responses, and secret material must not be stored by this contract");
  }
  if (!Array.isArray(record.sourceRefs) || !Array.isArray(record.tags)) errors.push("sourceRefs and tags must be arrays");
  if (!record.evaluations || typeof record.evaluations !== "object") errors.push("evaluations must be an object");
  return { ok: errors.length === 0, errors };
}

function createGoldenDatasetCase(input = {}) {
  return Object.freeze({
    caseId: requiredString(input.caseId, "caseId"),
    promptTemplateId: requiredString(input.promptTemplateId, "promptTemplateId"),
    expectedBehavior: requiredString(input.expectedBehavior, "expectedBehavior"),
    edgeCase: Boolean(input.edgeCase),
    policyExpectation: input.policyExpectation == null ? null : String(input.policyExpectation),
    referenceSourceIds: Object.freeze(normalizeStrings(input.referenceSourceIds)),
    containsSensitiveData: Boolean(input.containsSensitiveData),
    productionInput: false
  });
}

function scoreGoldenDatasetRun(testCase, actual = {}) {
  if (!testCase || typeof testCase !== "object") throw new Error("testCase is required");
  const checks = {
    behaviorMatched: Boolean(actual.behaviorMatched),
    policyMatched: actual.policyMatched !== false,
    grounded: actual.grounded !== false,
    noSecretLeak: actual.noSecretLeak !== false
  };
  const passed = Object.values(checks).every(Boolean);
  return Object.freeze({
    caseId: testCase.caseId,
    passed,
    checks: Object.freeze(checks),
    note: actual.note == null ? null : String(actual.note).slice(0, 500)
  });
}

function aggregateObservations(records = []) {
  const valid = records.filter((record) => validateLlmObservation(record).ok);
  const calls = valid.length;
  const totalDurationMs = valid.reduce((sum, item) => sum + item.durationMs, 0);
  const totalCostMicros = valid.reduce((sum, item) => sum + item.costMicros, 0);
  const totalInputTokens = valid.reduce((sum, item) => sum + item.inputTokens, 0);
  const totalOutputTokens = valid.reduce((sum, item) => sum + item.outputTokens, 0);
  const errors = valid.filter((item) => item.outcome === "error").length;
  const blocked = valid.filter((item) => item.outcome === "blocked").length;
  const review = valid.filter((item) => item.outcome === "needs_review").length;
  return Object.freeze({
    calls,
    averageDurationMs: calls ? Math.round(totalDurationMs / calls) : 0,
    totalCostMicros,
    totalInputTokens,
    totalOutputTokens,
    errorRate: calls ? errors / calls : 0,
    blockedRate: calls ? blocked / calls : 0,
    reviewRate: calls ? review / calls : 0
  });
}

function normalizeEvaluations(input) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const output = {};
  for (const key of EVALUATION_FIELDS) {
    const value = source[key];
    if (value == null) {
      output[key] = null;
      continue;
    }
    if (key === "policyViolationCount") {
      output[key] = nonNegativeInteger(value);
    } else {
      const numeric = Number(value);
      output[key] = Number.isFinite(numeric) ? Math.max(0, Math.min(1, numeric)) : null;
    }
  }
  return Object.freeze(output);
}

function normalizeTags(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return Object.freeze([]);
  const tags = Object.entries(input)
    .filter(([key, value]) => key && value != null)
    .map(([key, value]) => `${String(key).slice(0, 60)}:${String(value).slice(0, 120)}`)
    .slice(0, 40);
  return Object.freeze(tags);
}

function normalizeStrings(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean).slice(0, 100);
}

function fingerprint(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 24);
}

function requiredString(value, name) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`${name} is required`);
  return normalized;
}

function nonNegativeNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function nonNegativeInteger(value) {
  return Math.max(0, Math.floor(nonNegativeNumber(value)));
}

module.exports = {
  OUTCOMES,
  EVALUATION_FIELDS,
  createLlmObservation,
  validateLlmObservation,
  createGoldenDatasetCase,
  scoreGoldenDatasetRun,
  aggregateObservations
};
