// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { classifyAction } = require("./sonara-agent-authority.cjs");

const PLATFORM_KERNEL_VERSION = "1.0.0";

const PLATFORM_DOMAINS = Object.freeze({
  identity: Object.freeze(["organizations", "workspaces", "memberships", "roles", "permissions"]),
  operations: Object.freeze(["projects", "tasks", "records", "approvals"]),
  assets: Object.freeze(["assets", "files", "deliverables"]),
  automation: Object.freeze(["workflows", "workflow_runs", "events", "connectors"]),
  intelligence: Object.freeze(["ai_operations", "agents", "memory"]),
  commercial: Object.freeze(["billing", "entitlements", "usage"]),
  experience: Object.freeze(["notifications", "search", "audit"])
});

const EXECUTION_STATES = Object.freeze([
  "planned",
  "awaiting_approval",
  "ready",
  "running",
  "succeeded",
  "failed",
  "cancelled"
]);

const TERMINAL_STATES = Object.freeze(new Set(["succeeded", "failed", "cancelled"]));

const ALLOWED_TRANSITIONS = Object.freeze({
  planned: Object.freeze(new Set(["awaiting_approval", "ready", "cancelled"])),
  awaiting_approval: Object.freeze(new Set(["ready", "cancelled"])),
  ready: Object.freeze(new Set(["running", "cancelled"])),
  running: Object.freeze(new Set(["succeeded", "failed", "cancelled"])),
  succeeded: Object.freeze(new Set()),
  failed: Object.freeze(new Set()),
  cancelled: Object.freeze(new Set())
});

function requiredString(value, field) {
  const text = String(value == null ? "" : value).trim();
  if (!text) throw new TypeError(`${field} is required`);
  return text;
}

function optionalString(value) {
  const text = String(value == null ? "" : value).trim();
  return text || null;
}

function normalizeMetadata(value) {
  if (value == null) return {};
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new TypeError("metadata must be an object");
  }
  return { ...value };
}

function createExecutionEnvelope(input = {}) {
  const organizationId = requiredString(input.organizationId, "organizationId");
  const actorUserId = requiredString(input.actorUserId, "actorUserId");
  const workflowKey = requiredString(input.workflowKey, "workflowKey");
  const actionType = requiredString(input.actionType, "actionType");
  const idempotencyKey = requiredString(input.idempotencyKey, "idempotencyKey");
  const correlationId = requiredString(input.correlationId || idempotencyKey, "correlationId");
  const classification = classifyAction(actionType);
  const approvalState = classification.requiresOwnerApproval
    ? requiredString(input.approvalState || "pending", "approvalState")
    : "not_required";

  if (!["not_required", "pending", "approved", "rejected"].includes(approvalState)) {
    throw new TypeError("approvalState is invalid");
  }
  if (classification.requiresOwnerApproval && approvalState === "not_required") {
    throw new TypeError("sensitive actions cannot bypass approval");
  }

  return Object.freeze({
    kernelVersion: PLATFORM_KERNEL_VERSION,
    organizationId,
    actorUserId,
    workflowKey,
    actionType,
    idempotencyKey,
    correlationId,
    approvalState,
    requiresOwnerApproval: classification.requiresOwnerApproval,
    authorityCategory: classification.category,
    authorityReason: classification.reason,
    connectorKey: optionalString(input.connectorKey),
    resourceType: optionalString(input.resourceType),
    resourceId: optionalString(input.resourceId),
    metadata: Object.freeze(normalizeMetadata(input.metadata))
  });
}

function initialExecutionState(envelope) {
  if (!envelope || typeof envelope !== "object") throw new TypeError("execution envelope is required");
  return envelope.requiresOwnerApproval && envelope.approvalState !== "approved"
    ? "awaiting_approval"
    : "ready";
}

function assertTransition(from, to) {
  const source = requiredString(from, "from");
  const target = requiredString(to, "to");
  if (!ALLOWED_TRANSITIONS[source] || !ALLOWED_TRANSITIONS[target]) {
    throw new TypeError("unknown execution state");
  }
  if (!ALLOWED_TRANSITIONS[source].has(target)) {
    throw new Error(`invalid execution transition: ${source} -> ${target}`);
  }
  return true;
}

function buildPlatformEvent(envelope, eventName, details = {}) {
  if (!envelope || typeof envelope !== "object") throw new TypeError("execution envelope is required");
  const name = requiredString(eventName, "eventName");
  const metadata = normalizeMetadata(details.metadata);
  return Object.freeze({
    organization_id: envelope.organizationId,
    actor_user_id: envelope.actorUserId,
    correlation_id: envelope.correlationId,
    event_name: name,
    workflow_key: envelope.workflowKey,
    action_type: envelope.actionType,
    resource_type: envelope.resourceType,
    resource_id: envelope.resourceId,
    idempotency_key: envelope.idempotencyKey,
    metadata: Object.freeze({
      ...metadata,
      kernelVersion: PLATFORM_KERNEL_VERSION,
      authorityCategory: envelope.authorityCategory
    })
  });
}

function contractSnapshot() {
  return Object.freeze({
    version: PLATFORM_KERNEL_VERSION,
    domains: PLATFORM_DOMAINS,
    states: EXECUTION_STATES,
    terminalStates: Object.freeze([...TERMINAL_STATES])
  });
}

module.exports = {
  PLATFORM_KERNEL_VERSION,
  PLATFORM_DOMAINS,
  EXECUTION_STATES,
  TERMINAL_STATES,
  ALLOWED_TRANSITIONS,
  createExecutionEnvelope,
  initialExecutionState,
  assertTransition,
  buildPlatformEvent,
  contractSnapshot
};
