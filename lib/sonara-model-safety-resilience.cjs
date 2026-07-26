"use strict";

const { createHash } = require("node:crypto");
const {
  OBLITERATUS_SAFETY_REFERENCE,
  MODEL_SAFETY_CONTROL_AREAS
} = require("../data/obliteratus-safety-reference.cjs");

const POLICY_VERSION = "2026-07-26.1";

const BLOCKED_INTENT_PATTERNS = Object.freeze([
  /\b(remove|strip|disable|bypass|weaken|suppress|erase|excise)\b.{0,48}\b(safety|guardrail|refusal|alignment|restriction|filter)\b/i,
  /\b(abliterate|obliterate|uncensor|de[- ]?align|jailbreak)\b/i,
  /\b(refusal|safety|guardrail)\b.{0,48}\b(direction|vector|subspace|weight|layer|head|neuron)\b.{0,48}\b(remove|project|zero|ablate|modify)\b/i,
  /\b(export|publish|upload|push|serve|sell|distribute)\b.{0,48}\b(modified|uncensored|abliterated|de[- ]?aligned|safety[- ]?disabled)\b.{0,32}\b(model|weights|checkpoint|adapter)\b/i,
  /\b(push to (the )?(hub|hugging ?face)|hugging ?face upload|model export)\b/i,
  /\b(customer[- ]?facing|production)\b.{0,48}\b(uncensored|unrestricted|abliterated|safety[- ]?disabled)\b/i,
  /\b(run|execute|install|deploy|host)\b.{0,48}\b(obliteratus|abliteration|guardrail removal|refusal removal)\b/i
]);

const DEFENSIVE_RESEARCH_PATTERNS = Object.freeze([
  /\b(refusal integrity|alignment regression|safety regression|safety robustness)\b/i,
  /\b(defensive|authorized|isolated)\b.{0,32}\b(red[- ]?team|evaluation|benchmark|research|testing)\b/i,
  /\b(mechanistic interpretability|model safety evaluation|safety benchmark)\b/i,
  /\b(compare|measure|monitor|detect|audit)\b.{0,32}\b(refusal|safety|alignment|guardrail)\b/i,
  /\b(model provenance|artifact provenance|license review|telemetry review|egress review)\b/i
]);

function getModelSafetyReferenceSummary() {
  return Object.freeze({
    policyVersion: POLICY_VERSION,
    source: OBLITERATUS_SAFETY_REFERENCE,
    controlAreaCount: MODEL_SAFETY_CONTROL_AREAS.length,
    controlAreas: MODEL_SAFETY_CONTROL_AREAS,
    executionMode: "deterministic_local_policy_engine",
    runtimeDependency: false,
    upstreamExecutionAllowed: false
  });
}

function reviewModelSafetyProposal(input = {}) {
  const normalized = normalizeInput(input);
  if (!normalized.ok) return normalized;

  const searchable = [
    normalized.value.name,
    normalized.value.product,
    normalized.value.summary,
    normalized.value.requestedAction,
    ...normalized.value.dataTypes,
    ...normalized.value.outputs,
    ...normalized.value.controls
  ].join(" ").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

  const blockedMatches = BLOCKED_INTENT_PATTERNS
    .map((pattern) => pattern.exec(searchable))
    .filter(Boolean)
    .map((match) => String(match[0]).slice(0, 160));

  const defensiveMatches = DEFENSIVE_RESEARCH_PATTERNS
    .map((pattern) => pattern.exec(searchable))
    .filter(Boolean)
    .map((match) => String(match[0]).slice(0, 160));

  const prohibitedData = normalized.value.dataTypes.filter((item) => /customer prompts?|customer outputs?|credentials?|api keys?|access tokens?|private datasets?|production secrets?/i.test(item));
  const prohibitedOutputs = normalized.value.outputs.filter((item) => /modified weights?|uncensored model|abliterated model|de[- ]?aligned model|model export|hugging ?face/i.test(item));

  const blockedReasons = unique([
    ...blockedMatches.map((match) => `Blocked intent detected: ${match}`),
    ...prohibitedData.map((item) => `Protected data is not allowed: ${item}`),
    ...prohibitedOutputs.map((item) => `Prohibited model artifact or distribution output: ${item}`)
  ]);

  const decision = blockedReasons.length
    ? "blocked_safety_weakening_or_distribution"
    : defensiveMatches.length
      ? "reference_only_defensive_review_required"
      : "not_approved_scope_requires_clarification";

  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ policyVersion: POLICY_VERSION, proposal: normalized.value, decision }))
    .digest("hex")
    .slice(0, 24);

  return Object.freeze({
    ok: true,
    policyVersion: POLICY_VERSION,
    reviewFingerprint: fingerprint,
    decision,
    proposal: normalized.value,
    blockedReasons: Object.freeze(blockedReasons),
    defensiveEvidence: Object.freeze(unique(defensiveMatches)),
    allowedScope: OBLITERATUS_SAFETY_REFERENCE.allowedUses,
    blockedScope: OBLITERATUS_SAFETY_REFERENCE.blockedUses,
    requiredControls: MODEL_SAFETY_CONTROL_AREAS,
    activationRequirements: OBLITERATUS_SAFETY_REFERENCE.activationRequirements,
    referenceBoundary: Object.freeze({
      sourceRepository: OBLITERATUS_SAFETY_REFERENCE.repository,
      pinnedCommit: OBLITERATUS_SAFETY_REFERENCE.pinnedCommit,
      codeCopied: false,
      packageInstalled: false,
      runtimeDependency: false,
      upstreamExecutionAllowed: false,
      telemetryEnabled: false,
      modelWeightModificationAllowed: false,
      modelExportAllowed: false
    }),
    nextAction: blockedReasons.length
      ? "Reject the proposal. Redesign it as defensive evaluation of unmodified, owner-authorized models without weakening safeguards or distributing modified artifacts."
      : defensiveMatches.length
        ? "Prepare a separate, isolated, human-reviewed research plan with legal, safety, privacy, provenance, telemetry, and rollback evidence. Do not execute or modify models from this review endpoint."
        : "Clarify the defensive purpose, authorized model ownership, data boundary, evaluation metrics, and human review before any work proceeds."
  });
}

function normalizeInput(input) {
  const name = clean(input.name || input.moduleKey || input.module, 160);
  if (!name) return { ok: false, status: 400, code: "proposal_name_required" };

  return {
    ok: true,
    value: Object.freeze({
      name,
      product: clean(input.product, 120) || "research_lab",
      summary: clean(input.summary || input.description, 2000),
      requestedAction: clean(input.requestedAction || input.action, 1000),
      dataTypes: Object.freeze(normalizeList(input.dataTypes, 30, 240)),
      outputs: Object.freeze(normalizeList(input.outputs, 30, 240)),
      controls: Object.freeze(normalizeList(input.controls, 30, 240)),
      environment: oneOf(input.environment, ["documentation", "offline_research", "isolated_worker", "staging", "production"], "documentation")
    })
  };
}

function normalizeList(value, maxItems, maxLength) {
  const raw = Array.isArray(value) ? value : String(value || "").split(/[,\n]/g);
  return unique(raw.map((item) => clean(item, maxLength)).filter(Boolean)).slice(0, maxItems);
}

function clean(value, maxLength) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function oneOf(value, allowed, fallback) {
  const normalized = String(value || "").trim().toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

module.exports = {
  POLICY_VERSION,
  BLOCKED_INTENT_PATTERNS,
  DEFENSIVE_RESEARCH_PATTERNS,
  getModelSafetyReferenceSummary,
  normalizeInput,
  reviewModelSafetyProposal
};
