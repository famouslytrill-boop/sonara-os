"use strict";

// Durable transport for the event-driven agent contract.
//
// This module is intentionally a narrow storage adapter. It does not choose a
// broker, run an agent, call a provider, or decide whether an action is
// allowed. `sonara-event-driven-agent-contract.cjs` owns validation and
// authority; the outbox makes its accepted events survive a serverless process
// ending between the database write and worker delivery.
//
// The application uses a Supabase service key for this table, which bypasses
// RLS. That is why every query takes and repeats `organizationId`: a row ID or
// an idempotency key alone is never tenant authority.

const {
  EVENT_TOPICS,
  createAgentEvent,
  validateAgentEvent
} = require("./sonara-event-driven-agent-contract.cjs");

const OUTBOX_TABLE = "event_outbox";
const ATTEMPTS_TABLE = "event_delivery_attempts";
const OBSERVATIONS_TABLE = "llm_observations";
const EVALUATIONS_TABLE = "agent_evaluation_runs";
const CLAIM_FUNCTION = "claim_sonara_event_outbox";
const SETTLE_FUNCTION = "settle_sonara_event_outbox";

const RUN_STATUS_TO_EVENT = Object.freeze({
  completed: Object.freeze({ topic: EVENT_TOPICS.RESULTS, kind: "agent.work.completed" }),
  failed: Object.freeze({ topic: EVENT_TOPICS.RESULTS, kind: "agent.work.failed" }),
  unimplemented: Object.freeze({ topic: EVENT_TOPICS.RESULTS, kind: "agent.work.failed" }),
  refused: Object.freeze({ topic: EVENT_TOPICS.APPROVALS, kind: "approval.requested" })
});

function createEventOutboxRepository({ getSupabaseServerConfig, fetchImpl = fetch } = {}) {
  if (typeof getSupabaseServerConfig !== "function") throw new TypeError("getSupabaseServerConfig is required");
  if (typeof fetchImpl !== "function") throw new TypeError("fetchImpl is required");

  async function enqueue(event) {
    const validation = validateAgentEvent(event);
    if (!validation.ok) throw invalidEvent(validation.errors);
    const config = getConfig(getSupabaseServerConfig);
    if (!config.ok) return { ok: false, code: "setup_required", row: null };

    const response = await request(config, fetchImpl, `/${OUTBOX_TABLE}?on_conflict=organization_id,idempotency_key`, {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify(outboxRow(event))
    });
    if (!response.ok) return { ok: false, code: "unwritable", status: response.status, row: null };

    const rows = await response.json().catch(() => []);
    if (Array.isArray(rows) && rows[0]) return { ok: true, created: true, row: rows[0] };

    // PostgREST returns an empty representation when ignore-duplicates catches
    // a producer retry. It is not a successful enqueue until we prove the
    // existing row belongs to this organization and key.
    const existing = await request(
      config,
      fetchImpl,
      `/${OUTBOX_TABLE}?select=${encodeURIComponent(outboxSelect())}` +
        `&organization_id=eq.${encodeURIComponent(event.organizationId)}` +
        `&idempotency_key=eq.${encodeURIComponent(event.idempotencyKey)}` +
        "&limit=1",
      { headers: { Accept: "application/json" } }
    );
    if (!existing.ok) return { ok: false, code: "dedupe_unreadable", status: existing.status, row: null };
    const existingRows = await existing.json().catch(() => []);
    if (!Array.isArray(existingRows) || !existingRows[0]) return { ok: false, code: "dedupe_missing", row: null };
    return { ok: true, created: false, row: existingRows[0] };
  }

  async function claimNext({ organizationId, consumer, now = new Date().toISOString() } = {}) {
    const scope = requiredString(organizationId, "organizationId");
    const worker = requiredString(consumer, "consumer");
    const config = getConfig(getSupabaseServerConfig);
    if (!config.ok) return { ok: false, code: "setup_required", row: null };

    const response = await request(config, fetchImpl, `/rpc/${CLAIM_FUNCTION}`, {
      method: "POST",
      body: JSON.stringify({ p_organization_id: scope, p_consumer: worker, p_now: now })
    });
    if (!response.ok) return { ok: false, code: "claim_failed", status: response.status, row: null };
    const rows = await response.json().catch(() => []);
    return { ok: true, row: Array.isArray(rows) && rows[0] ? rows[0] : null };
  }

  async function settle({ organizationId, eventOutboxId, consumer, outcome, errorCode = null, nextAvailableAt = null, now = new Date().toISOString() } = {}) {
    const scope = requiredString(organizationId, "organizationId");
    const id = requiredString(eventOutboxId, "eventOutboxId");
    const worker = requiredString(consumer, "consumer");
    if (!["delivered", "retry", "dead_lettered"].includes(outcome)) throw new TypeError("outcome must be delivered, retry, or dead_lettered");
    const config = getConfig(getSupabaseServerConfig);
    if (!config.ok) return { ok: false, code: "setup_required", row: null };

    const response = await request(config, fetchImpl, `/rpc/${SETTLE_FUNCTION}`, {
      method: "POST",
      body: JSON.stringify({
        p_organization_id: scope,
        p_event_outbox_id: id,
        p_consumer: worker,
        p_outcome: outcome,
        p_error_code: errorCode == null ? null : String(errorCode).slice(0, 120),
        p_next_available_at: nextAvailableAt,
        p_now: now
      })
    });
    if (!response.ok) return { ok: false, code: "settle_failed", status: response.status, row: null };
    const rows = await response.json().catch(() => []);
    // A 200 plus no row means another worker settled/released the claim first;
    // pretending delivery succeeded would duplicate a side effect on retry.
    if (!Array.isArray(rows) || !rows[0]) return { ok: false, code: "claim_lost", row: null };
    return { ok: true, row: rows[0] };
  }

  return Object.freeze({ enqueue, claimNext, settle });
}

function createRunEventPublisher({ organizationId, actorId, producer = "sonara-agent-runner", repository } = {}) {
  const scope = requiredString(organizationId, "organizationId");
  const actor = requiredString(actorId, "actorId");
  if (!repository || typeof repository.enqueue !== "function") throw new TypeError("repository.enqueue is required");

  return async function publishAgentRun({ run, action } = {}) {
    const mapping = RUN_STATUS_TO_EVENT[String(run?.status || "")];
    if (!mapping) return { ok: false, code: "unsupported_run_status" };
    const actionType = String(run?.actionType || action?.action_type || "agent_action").trim() || "agent_action";
    const correlationId = String(action?.id || run?.correlationId || "").trim() || undefined;
    const event = createAgentEvent({
      organizationId: scope,
      actorId: actor,
      producer,
      topic: mapping.topic,
      kind: mapping.kind,
      action: actionType,
      correlationId,
      authority: run?.classification?.requiresOwnerApproval ? "owner_review" : "low_risk",
      // The result and reason are deliberately omitted. Handlers often touch
      // customer records, and a durable operational event is not a second
      // customer-data store. Owners can consult the scoped source record.
      payload: {
        actionId: action?.id == null ? null : String(action.id),
        status: String(run?.status || "unknown"),
        classification: String(run?.classification?.category || "unknown")
      },
      provenance: { sourceType: "agent_run", sourceId: action?.id == null ? null : String(action.id), userProvided: false, licensedOrOwned: null }
    });
    return repository.enqueue(event);
  };
}

function outboxRow(event) {
  return {
    organization_id: event.organizationId,
    event_id: event.eventId,
    topic: event.topic,
    kind: event.kind,
    action: event.action,
    actor_id: event.actorId,
    producer: event.producer,
    correlation_id: event.correlationId,
    causation_id: event.causationId,
    idempotency_key: event.idempotencyKey,
    authority: event.authority,
    payload: event.payload,
    provenance: event.provenance
  };
}

function outboxSelect() {
  return "id,organization_id,event_id,topic,kind,action,actor_id,producer,correlation_id,causation_id,idempotency_key,authority,state,attempt_count,available_at,claimed_by,claimed_at,delivered_at,last_error_code,created_at";
}

function getConfig(getSupabaseServerConfig) {
  const config = getSupabaseServerConfig();
  if (!config?.ok || !String(config.url || "").trim() || !String(config.serviceRoleKey || "").trim()) return { ok: false };
  return { ok: true, url: String(config.url).replace(/\/+$/, ""), serviceRoleKey: String(config.serviceRoleKey) };
}

async function request(config, fetchImpl, path, init = {}) {
  try {
    return await fetchImpl(`${config.url}/rest/v1${path}`, {
      ...init,
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init.headers || {})
      }
    });
  } catch {
    return { ok: false, status: 0, json: async () => [] };
  }
}

function invalidEvent(errors) {
  const error = new TypeError(`event is invalid: ${errors.join("; ")}`);
  error.code = "SONARA_EVENT_INVALID";
  return error;
}

function requiredString(value, name) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new TypeError(`${name} is required`);
  return normalized;
}

module.exports = {
  OUTBOX_TABLE,
  ATTEMPTS_TABLE,
  OBSERVATIONS_TABLE,
  EVALUATIONS_TABLE,
  CLAIM_FUNCTION,
  SETTLE_FUNCTION,
  RUN_STATUS_TO_EVENT,
  createEventOutboxRepository,
  createRunEventPublisher,
  outboxRow
};
