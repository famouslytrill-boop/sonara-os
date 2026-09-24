// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Narrow Supabase Queues / PGMQ transport for the first one-tenant canary.
//
// This module does not create queues and does not expose pgmq_public. Those are
// environment-owner actions. It only consumes the pgmq_public RPC surface once
// an isolated environment has explicitly enabled it.
//
// The transport is intentionally bound to exactly one organization and one
// queue. A message for another organization is refused and left unsettled so a
// canary can never silently process another tenant's work.

const PGMQ_PUBLIC_SCHEMA = "pgmq_public";
const QUEUE_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{0,47}$/;
const DEFAULT_VISIBILITY_SECONDS = 30;
const MAX_VISIBILITY_SECONDS = 900;
const MAX_BATCH = 10;

function createPgmqCanaryTransport({
  organizationId,
  queueName,
  getSupabaseServerConfig,
  fetchImpl = fetch
} = {}) {
  const scope = requiredUuid(organizationId, "organizationId");
  const queue = requiredQueueName(queueName);
  if (typeof getSupabaseServerConfig !== "function") throw new TypeError("getSupabaseServerConfig is required");
  if (typeof fetchImpl !== "function") throw new TypeError("fetchImpl is required");

  async function send(message, { delaySeconds = 0 } = {}) {
    const payload = requiredMessage(message);
    const delay = boundedInteger(delaySeconds, "delaySeconds", 0, MAX_VISIBILITY_SECONDS);
    const config = getConfig(getSupabaseServerConfig);
    if (!config.ok) return failure("setup_required");

    const response = await rpc(config, fetchImpl, "send", {
      queue_name: queue,
      message: { ...payload, organizationId: scope },
      sleep_seconds: delay
    });
    if (!response.ok) return failure("send_failed", response.status);
    const data = await response.json().catch(() => null);
    const messageId = firstScalar(data);
    if (messageId == null) return failure("unexpected_send_shape", response.status);
    return Object.freeze({ ok: true, messageId: String(messageId) });
  }

  async function read({ visibilitySeconds = DEFAULT_VISIBILITY_SECONDS, limit = 1 } = {}) {
    const visibility = boundedInteger(
      visibilitySeconds,
      "visibilitySeconds",
      1,
      MAX_VISIBILITY_SECONDS
    );
    const quantity = boundedInteger(limit, "limit", 1, MAX_BATCH);
    const config = getConfig(getSupabaseServerConfig);
    if (!config.ok) return failure("setup_required", null, []);

    const response = await rpc(config, fetchImpl, "read", {
      queue_name: queue,
      sleep_seconds: visibility,
      n: quantity
    });
    if (!response.ok) return failure("read_failed", response.status, []);

    const rows = await response.json().catch(() => null);
    if (!Array.isArray(rows)) return failure("unexpected_read_shape", response.status, []);

    const messages = [];
    for (const row of rows) {
      const normalized = normalizeRow(row);
      if (!normalized.ok) return failure(normalized.code, response.status, messages);
      if (normalized.message.organizationId !== scope) {
        return Object.freeze({
          ok: false,
          code: "tenant_mismatch",
          status: response.status,
          messages,
          refusedMessageId: normalized.messageId
        });
      }
      messages.push(normalized);
    }
    return Object.freeze({ ok: true, messages });
  }

  async function archive(messageId) {
    return settle("archive", messageId);
  }

  async function deleteMessage(messageId) {
    return settle("delete", messageId);
  }

  async function settle(operation, messageId) {
    const id = requiredMessageId(messageId);
    const config = getConfig(getSupabaseServerConfig);
    if (!config.ok) return failure("setup_required");

    const response = await rpc(config, fetchImpl, operation, {
      queue_name: queue,
      message_id: id
    });
    if (!response.ok) return failure(`${operation}_failed`, response.status);
    const data = await response.json().catch(() => null);
    const result = firstScalar(data);
    if (result !== true) return failure(`${operation}_not_confirmed`, response.status);
    return Object.freeze({ ok: true, messageId: String(id) });
  }

  return Object.freeze({
    organizationId: scope,
    queueName: queue,
    send,
    read,
    archive,
    deleteMessage
  });
}

async function rpc(config, fetchImpl, functionName, body) {
  try {
    return await fetchImpl(`${config.url}/rest/v1/rpc/${functionName}`, {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Profile": PGMQ_PUBLIC_SCHEMA,
        "Content-Profile": PGMQ_PUBLIC_SCHEMA
      },
      body: JSON.stringify(body)
    });
  } catch {
    return { ok: false, status: 0, json: async () => null };
  }
}

function normalizeRow(row) {
  if (!row || typeof row !== "object" || Array.isArray(row)) return { ok: false, code: "invalid_message_row" };
  const messageId = row.msg_id ?? row.message_id ?? row.id;
  if (messageId == null) return { ok: false, code: "missing_message_id" };
  if (!row.message || typeof row.message !== "object" || Array.isArray(row.message)) {
    return { ok: false, code: "invalid_message_payload" };
  }
  return Object.freeze({
    ok: true,
    messageId: String(messageId),
    readCount: Number(row.read_ct ?? 0),
    enqueuedAt: row.enqueued_at == null ? null : String(row.enqueued_at),
    visibleAt: row.vt == null ? null : String(row.vt),
    message: Object.freeze({ ...row.message })
  });
}

function firstScalar(data) {
  if (Array.isArray(data)) {
    if (data.length === 0) return null;
    const value = data[0];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const keys = Object.keys(value);
      return keys.length === 1 ? value[keys[0]] : null;
    }
    return value;
  }
  if (data && typeof data === "object") {
    const keys = Object.keys(data);
    return keys.length === 1 ? data[keys[0]] : null;
  }
  return data;
}

function getConfig(getSupabaseServerConfig) {
  const config = getSupabaseServerConfig();
  const url = String(config?.url || "").trim().replace(/\/+$/, "");
  const serviceRoleKey = String(config?.serviceRoleKey || "").trim();
  if (!config?.ok || !url || !serviceRoleKey) return { ok: false };
  return { ok: true, url, serviceRoleKey };
}

function requiredMessage(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("message must be a JSON object");
  }
  if ("organizationId" in value || "organization_id" in value) {
    throw new TypeError("message organization scope is assigned by the transport");
  }
  return { ...value };
}

function requiredQueueName(value) {
  const name = String(value || "").trim();
  if (!QUEUE_NAME_PATTERN.test(name)) {
    throw new TypeError("queueName must use lowercase letters, numbers, hyphens, or underscores");
  }
  return name;
}

function requiredUuid(value, name) {
  const normalized = String(value || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
    throw new TypeError(`${name} must be a UUID`);
  }
  return normalized;
}

function requiredMessageId(value) {
  const normalized = String(value ?? "").trim();
  if (!/^[1-9][0-9]*$/.test(normalized)) throw new TypeError("messageId must be a positive integer");
  return normalized;
}

function boundedInteger(value, name, min, max) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < min || numeric > max) {
    throw new TypeError(`${name} must be an integer between ${min} and ${max}`);
  }
  return numeric;
}

function failure(code, status = null, messages) {
  const result = { ok: false, code, status };
  if (messages !== undefined) result.messages = messages;
  return Object.freeze(result);
}

module.exports = {
  PGMQ_PUBLIC_SCHEMA,
  QUEUE_NAME_PATTERN,
  DEFAULT_VISIBILITY_SECONDS,
  MAX_VISIBILITY_SECONDS,
  MAX_BATCH,
  createPgmqCanaryTransport
};
