"use strict";

const crypto = require("node:crypto");

// The one decider for "does this need the owner". See authorityForAction
// below for why this module no longer answers that question itself.
// lib/sonara-agent-authority.cjs requires nothing, so this direction is safe.
const { classifyAction } = require("./sonara-agent-authority.cjs");

const EVENT_VERSION = 1;

const EVENT_TOPICS = Object.freeze({
  COMMANDS: "agent.commands",
  RESULTS: "agent.results",
  SECURITY: "security.findings",
  MEDIA: "media.jobs",
  OBSERVABILITY: "observability.llm",
  APPROVALS: "authority.approvals",
  DEAD_LETTER: "system.dead-letter"
});

const EVENT_KINDS = Object.freeze([
  "agent.command.requested",
  "agent.work.started",
  "agent.work.completed",
  "agent.work.failed",
  "agent.dead_lettered",
  "security.finding.created",
  "media.job.requested",
  "media.job.completed",
  "observability.llm_span.recorded",
  "approval.requested",
  "approval.decided"
]);

const DELIVERY_POLICY = Object.freeze({
  semantics: "at_least_once",
  immutableLogRequired: true,
  idempotencyRequired: true,
  replaySupported: true,
  maxDeliveryAttempts: 5,
  deadLetterAfterMaxAttempts: true,
  consumerIsolationRequired: true,
  tenantKeyRequired: true
});

// The nine action names this contract documents as consequential. It is
// DOCUMENTATION and a floor for the agreement gate -- it is no longer what
// authorityForAction consults, because an allowlist of names fails open on
// the tenth name. scripts/verify-event-authority-agreement.mjs asserts the
// authority module still gates every one of them, so this list cannot drift
// into being quietly wrong.
const OWNER_REVIEW_ACTIONS = Object.freeze([
  "refund",
  "payout_change",
  "publish_legal_or_policy",
  "launch_customer_campaign",
  "publish_review_or_proof",
  "change_security_settings",
  "destructive_data_change",
  "publish_social_content",
  "send_bulk_outreach"
]);

const FORBIDDEN_SECRET_KEYS = Object.freeze(new Set([
  "authorization",
  "password",
  "secret",
  "token",
  "api_key",
  "apikey",
  "service_role_key",
  "private_key",
  "client_secret"
]));

function createAgentEvent(input = {}) {
  const occurredAt = input.occurredAt || new Date().toISOString();
  const eventId = input.eventId || crypto.randomUUID();
  const correlationId = input.correlationId || eventId;
  const action = String(input.action || "").trim();
  const authority = input.authority || authorityForAction(action);
  const envelope = {
    version: EVENT_VERSION,
    eventId,
    occurredAt,
    organizationId: requiredString(input.organizationId, "organizationId"),
    actorId: requiredString(input.actorId, "actorId"),
    producer: requiredString(input.producer, "producer"),
    topic: requiredString(input.topic, "topic"),
    kind: requiredString(input.kind, "kind"),
    action: action || null,
    correlationId,
    causationId: input.causationId || null,
    idempotencyKey: input.idempotencyKey || makeIdempotencyKey({
      organizationId: input.organizationId,
      correlationId,
      kind: input.kind,
      action,
      producer: input.producer
    }),
    authority,
    payload: input.payload == null ? {} : clonePlain(input.payload),
    provenance: normalizeProvenance(input.provenance),
    attempt: Number.isInteger(input.attempt) && input.attempt > 0 ? input.attempt : 1
  };

  const validation = validateAgentEvent(envelope);
  if (!validation.ok) {
    const error = new Error(`Invalid SONARA agent event: ${validation.errors.join("; ")}`);
    error.code = "SONARA_EVENT_INVALID";
    throw error;
  }
  return Object.freeze(envelope);
}

function validateAgentEvent(event) {
  const errors = [];
  if (!event || typeof event !== "object" || Array.isArray(event)) return { ok: false, errors: ["event must be an object"] };
  if (event.version !== EVENT_VERSION) errors.push(`version must be ${EVENT_VERSION}`);
  for (const key of ["eventId", "occurredAt", "organizationId", "actorId", "producer", "topic", "kind", "correlationId", "idempotencyKey", "authority"]) {
    if (typeof event[key] !== "string" || !event[key].trim()) errors.push(`${key} is required`);
  }
  if (!EVENT_KINDS.includes(event.kind)) errors.push(`unsupported kind: ${event.kind}`);
  if (!Object.values(EVENT_TOPICS).includes(event.topic)) errors.push(`unsupported topic: ${event.topic}`);
  if (!Number.isInteger(event.attempt) || event.attempt < 1) errors.push("attempt must be a positive integer");
  if (!event.payload || typeof event.payload !== "object" || Array.isArray(event.payload)) errors.push("payload must be an object");
  const secretPaths = findForbiddenSecretPaths(event.payload);
  if (secretPaths.length) errors.push(`payload contains forbidden secret fields: ${secretPaths.join(", ")}`);
  if (event.authority === "owner_review" && !event.action) errors.push("owner_review events require an action");
  return { ok: errors.length === 0, errors };
}

// Which authority an action carries. Delegated, deliberately.
//
// ## What this used to do, and why it was wrong
//
// It looked the action up in OWNER_REVIEW_ACTIONS below and returned
// `low_risk` when it was not there. That is an allowlist of nine names that
// FAILS OPEN: every sensitive action nobody had thought to add to it came back
// `low_risk`, and `canDispatch` lets a `low_risk` event through with no owner
// approval at all.
//
// Measured 18 September 2026 against eight plainly consequential action names,
// none of them literally in the nine:
//
//   delete_customer_records      authority module: owner_review   here: low_risk
//   issue_refund_batch           authority module: owner_review   here: low_risk
//   rotate_api_key               authority module: owner_review   here: low_risk
//   purge_audit_log              authority module: owner_review   here: low_risk
//   change_payout_bank_account   authority module: owner_review   here: low_risk
//   publish_terms_of_service     authority module: owner_review   here: low_risk
//   send_bulk_sms                authority module: owner_review   here: low_risk
//   grant_role_admin             authority module: owner_review   here: low_risk
//
// Eight of eight. `canDispatch` on the first returned
// `{ ok: true, reason: "low_risk_authority" }`.
//
// AGENTS.md says "Unknown sensitive actions default to owner review", and
// CLAUDE.md says of lib/sonara-agent-authority.cjs: "The default is deny,
// deliberately: a classifier that fails open fails open exactly when somebody
// adds a capability, which is the moment nobody is reading that file." This
// module had a second classifier with the opposite default, and the two agreed
// only on the nine names that happened to be in both.
//
// So it asks the authority module now. One decider, and it is the one the
// release chain already verifies.
//
// An action-less event stays `low_risk`, because there is no action to gate --
// and `validateAgentEvent` refuses an `owner_review` event with no action, so
// the alternative is not even representable.
function authorityForAction(action) {
  const normalized = String(action || "").trim();
  if (!normalized) return "low_risk";
  let classification;
  try {
    // A STRING. classifyAction normalises whatever it is given with String(),
    // so an object argument becomes the literal "[object Object]", lands in
    // the `unrecognised` category, and returns requiresOwnerApproval: true.
    // That fails safe, which is why it is easy to miss: the first draft of
    // this function passed an object and every action -- including all seven
    // self-serve ones -- came back owner_review. It looked like a working
    // gate and would have sent every draft to the owner.
    classification = classifyAction(normalized);
  } catch {
    // The classifier refusing to answer is not permission. This is the one
    // place a throw could quietly become `low_risk`, so it does not.
    return "owner_review";
  }
  return classification && classification.requiresOwnerApproval === false ? "low_risk" : "owner_review";
}

function requiresOwnerReview(event) {
  return event && event.authority === "owner_review";
}

function canDispatch(event, approval = {}) {
  const validation = validateAgentEvent(event);
  if (!validation.ok) return { ok: false, reason: "invalid_event", errors: validation.errors };
  if (!requiresOwnerReview(event)) return { ok: true, reason: "low_risk_authority" };
  const approved = approval
    && approval.status === "approved"
    && approval.eventId === event.eventId
    && approval.organizationId === event.organizationId
    && typeof approval.approvedBy === "string"
    && approval.approvedBy.trim();
  return approved
    ? { ok: true, reason: "owner_approval_present" }
    : { ok: false, reason: "owner_approval_required", errors: [] };
}

function nextDeliveryDecision(event, error) {
  const attempt = event && Number.isInteger(event.attempt) ? event.attempt : 1;
  if (attempt >= DELIVERY_POLICY.maxDeliveryAttempts) {
    return {
      action: "dead_letter",
      topic: EVENT_TOPICS.DEAD_LETTER,
      reason: safeErrorCode(error),
      replayable: true
    };
  }
  return {
    action: "retry",
    nextAttempt: attempt + 1,
    reason: safeErrorCode(error),
    replayable: true
  };
}

function telemetryView(event) {
  const validation = validateAgentEvent(event);
  if (!validation.ok) throw new Error(`Cannot emit telemetry for invalid event: ${validation.errors.join("; ")}`);
  return Object.freeze({
    version: event.version,
    eventId: event.eventId,
    occurredAt: event.occurredAt,
    organizationId: event.organizationId,
    producer: event.producer,
    topic: event.topic,
    kind: event.kind,
    action: event.action,
    correlationId: event.correlationId,
    causationId: event.causationId,
    idempotencyKey: event.idempotencyKey,
    authority: event.authority,
    attempt: event.attempt,
    provenance: event.provenance,
    payloadIncluded: false
  });
}

function makeIdempotencyKey(input = {}) {
  const parts = [
    input.organizationId,
    input.correlationId,
    input.kind,
    input.action,
    input.producer
  ].map((value) => String(value || "").trim()).join("|");
  return `evt_${crypto.createHash("sha256").update(parts).digest("hex").slice(0, 32)}`;
}

function normalizeProvenance(value) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.freeze({
    sourceType: String(input.sourceType || "system"),
    sourceId: input.sourceId == null ? null : String(input.sourceId),
    userProvided: Boolean(input.userProvided),
    licensedOrOwned: input.licensedOrOwned == null ? null : Boolean(input.licensedOrOwned)
  });
}

function findForbiddenSecretPaths(value, path = "payload") {
  const found = [];
  if (!value || typeof value !== "object") return found;
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.toLowerCase().replace(/[-\s]/g, "_");
    const childPath = `${path}.${key}`;
    if (FORBIDDEN_SECRET_KEYS.has(normalized)) found.push(childPath);
    if (child && typeof child === "object") found.push(...findForbiddenSecretPaths(child, childPath));
  }
  return found;
}

function requiredString(value, name) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`${name} is required`);
  return normalized;
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function safeErrorCode(error) {
  if (!error) return "unknown_error";
  const code = typeof error.code === "string" && error.code.trim() ? error.code : "delivery_error";
  return code.slice(0, 80);
}

module.exports = {
  EVENT_VERSION,
  EVENT_TOPICS,
  EVENT_KINDS,
  DELIVERY_POLICY,
  OWNER_REVIEW_ACTIONS,
  createAgentEvent,
  validateAgentEvent,
  authorityForAction,
  requiresOwnerReview,
  canDispatch,
  nextDeliveryDecision,
  telemetryView,
  makeIdempotencyKey
};
