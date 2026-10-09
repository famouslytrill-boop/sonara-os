// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// NOT RUNTIME-WIRED: a reviewed private-schema migration and database role
// are prerequisites. All values are bound parameters. No credentials or
// database handles may come from a browser or an autonomous agent.
const ENVIRONMENTS = Object.freeze(["local", "preview", "staging", "production"]);
const SCOPES = Object.freeze(["platform", "tenant"]);
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function scopeParameters(environmentKey, scope, organizationId) {
  if (!SCOPES.includes(scope) ||
      (scope === "platform" && organizationId !== null) ||
      (scope === "tenant" && (typeof organizationId !== "string" ||
        !UUID.test(organizationId)))) {
    throw new TypeError("invalid_transaction_scope");
  }
  return [environmentKey, scope, organizationId];
}
const SQL = Object.freeze({
  now: "select floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text as now_ms",
  state: [
    "select id, scope, organization_id, mode, revision::text as revision",
    "from sonara_operations.operational_scope_state",
    "where environment_key = $1 and scope = $2",
    "and organization_id is not distinct from $3::uuid for update"
  ].join(" "),
  approval: [
    "select a.id, a.status, a.consumed_at, a.revoked_at, s.scope,",
    "s.organization_id, a.from_mode, a.to_mode,",
    "a.expected_revision::text as expected_revision, a.approved_by,",
    "floor(extract(epoch from a.issued_at) * 1000)::bigint::text as issued_ms,",
    "floor(extract(epoch from a.expires_at) * 1000)::bigint::text as expires_ms",
    "from sonara_operations.operational_approvals a",
    "join sonara_operations.operational_scope_state s on s.id = a.state_id",
    "where a.id = $1::uuid and s.environment_key = $2 and s.scope = $3",
    "and s.organization_id is not distinct from $4::uuid for update of a"
  ].join(" "),
  consume: [
    "update sonara_operations.operational_approvals a",
    "set consumed_at = clock_timestamp(), consumed_event_id = $2::uuid",
    "from sonara_operations.operational_scope_state s",
    "where a.id = $1::uuid and a.state_id = s.id",
    "and s.environment_key = $3 and s.scope = $4",
    "and s.organization_id is not distinct from $5::uuid",
    "and a.expected_revision = $6::bigint",
    "and a.status = 'approved' and a.revoked_at is null",
    "and a.consumed_at is null and a.issued_at <= clock_timestamp()",
    "and a.expires_at >= clock_timestamp() returning a.id"
  ].join(" "),
  cas: [
    "update sonara_operations.operational_scope_state",
    "set mode = $4, revision = revision + 1, updated_at = clock_timestamp()",
    "where environment_key = $1 and scope = $2",
    "and organization_id is not distinct from $3::uuid",
    "and mode = $5 and revision = $6::bigint",
    "and revision + 1 = $7::bigint returning id"
  ].join(" "),
  event: [
    "insert into sonara_operations.operational_transition_events",
    "(id, state_id, approval_id, revision, from_mode, to_mode, actor_id, recorded_at)",
    "select $1::uuid, s.id, $2::uuid, $3::bigint, $4, $5, $6::uuid, clock_timestamp()",
    "from sonara_operations.operational_scope_state s",
    "where s.environment_key = $7 and s.scope = $8",
    "and s.organization_id is not distinct from $9::uuid",
    "and s.mode = $5 and s.revision = $3::bigint",
    "on conflict do nothing returning id"
  ].join(" "),
  // Read-only immutable event proof; does not assume the state has stayed at
  // the next revision if another independently approved transition followed.
  committedEvent: [
    "select e.id, e.approval_id, e.actor_id, e.from_mode, e.to_mode,",
    "e.revision::text as revision, a.expected_revision::text as expected_revision,",
    "s.scope, s.organization_id",
    "from sonara_operations.operational_transition_events e",
    "join sonara_operations.operational_scope_state s on s.id = e.state_id",
    "join sonara_operations.operational_approvals a",
    "on a.id = e.approval_id and a.state_id = e.state_id",
    "where e.id = $1::uuid and e.approval_id = $2::uuid",
    "and s.environment_key = $3 and s.scope = $4",
    "and s.organization_id is not distinct from $5::uuid",
    "and e.actor_id = $6::uuid and e.revision = $7::bigint",
    "and e.to_mode = $8 and e.from_mode = a.from_mode",
    "and e.to_mode = a.to_mode and a.consumed_event_id = e.id",
    "and a.consumed_at is not null",
    "and a.expected_revision = $9::bigint",
    "and e.revision = a.expected_revision + 1",
    "and s.revision >= e.revision"
  ].join(" ")
});
function safeInteger(raw) {
  if (typeof raw !== "number" && typeof raw !== "string") return NaN;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 0 ? value : NaN;
}
function uniqueRow(result) {
  if (!result || result.rowCount === 0) return null;
  if (result.rowCount !== 1 || !Array.isArray(result.rows) || result.rows.length !== 1) {
    throw new Error("operational_row_uniqueness_unverified");
  }
  return result.rows[0];
}
function affectedOne(result) {
  return result?.rowCount === 1 && Array.isArray(result.rows) &&
    result.rows.length === 1 ? 1 : 0;
}
function createPostgresOperationalStore({ pool, environmentKey } = {}) {
  if (!pool || typeof pool.connect !== "function" ||
      !ENVIRONMENTS.includes(environmentKey)) {
    throw new TypeError("trusted_postgres_pool_and_environment_required");
  }
  return Object.freeze({
    async withTransaction(work) {
      if (typeof work !== "function") throw new TypeError("transaction_callback_required");
      const client = await pool.connect();
      if (!client || typeof client.query !== "function" ||
          typeof client.release !== "function") {
        throw new TypeError("trusted_postgres_client_required");
      }
      let begun = false;
      let commitAttempted = false;
      try {
        await client.query("BEGIN");
        begun = true;
        await client.query("SET LOCAL lock_timeout = '2000ms'");
        await client.query("SET LOCAL statement_timeout = '10000ms'");
        const scoped = (scope, organizationId) =>
          scopeParameters(environmentKey, scope, organizationId);
        const read = async (sql, values) => uniqueRow(await client.query(sql, values));
        const tx = Object.freeze({
          // Only trusted server authorizers/verifiers may call this method;
          // client input must never contain SQL text or parameter arrays.
          authorizedQuery: (sql, values) => client.query(sql, values),
          async nowMs() {
            const row = await read(SQL.now, []);
            return safeInteger(row?.now_ms);
          },
          async readStateForUpdate({ scope, organizationId }) {
            const row = await read(SQL.state, scoped(scope, organizationId));
            return row && {
              scope: row.scope, organizationId: row.organization_id,
              mode: row.mode, revision: safeInteger(row.revision)
            };
          },
          async readApprovalForUpdate({ approvalId, scope, organizationId }) {
            const row = await read(SQL.approval, [approvalId, ...scoped(scope, organizationId)]);
            return row && {
              id: row.id, status: row.status,
              consumedAtMs: row.consumed_at == null ? null : 1,
              revokedAtMs: row.revoked_at == null ? null : 1,
              scope: row.scope, organizationId: row.organization_id,
              from: row.from_mode, to: row.to_mode,
              expectedRevision: safeInteger(row.expected_revision),
              approvedBy: row.approved_by,
              issuedAtMs: safeInteger(row.issued_ms),
              expiresAtMs: safeInteger(row.expires_ms)
            };
          },
          async consumeApproval({ approvalId, scope, organizationId,
            expectedRevision, eventId }) {
            const res = await client.query(SQL.consume, [
              approvalId, eventId, ...scoped(scope, organizationId), String(expectedRevision)
            ]);
            return affectedOne(res);
          },
          async compareAndSwapState({ scope, organizationId, expectedMode,
            expectedRevision, nextMode, nextRevision }) {
            const res = await client.query(SQL.cas, [
              ...scoped(scope, organizationId), nextMode,
              expectedMode, String(expectedRevision), String(nextRevision)
            ]);
            return affectedOne(res);
          },
          async appendAuditEvent({ eventId, approvalId, actorId, scope,
            organizationId, from, to, revision }) {
            const res = await client.query(SQL.event, [
              eventId, approvalId, String(revision), from, to, actorId,
              ...scoped(scope, organizationId)
            ]);
            return affectedOne(res);
          }
        });
        const receipt = await work(tx);
        commitAttempted = true;
        await client.query("COMMIT");
        return receipt;
      } catch (error) {
        if (begun) {
          try { await client.query("ROLLBACK"); } catch { /* preserve error */ }
        }
        if (commitAttempted) {
          // COMMIT might succeed server-side while the response is lost.
          // Reconcile by event ID; never automatically replay an approval.
          const uncertain = new Error("operational_commit_outcome_unknown");
          uncertain.code = "SONARA_COMMIT_OUTCOME_UNKNOWN";
          throw uncertain;
        }
        throw error;
      } finally {
        // COMMIT may have succeeded: a pool-cleanup error must not transform
        // a confirmed commit into an apparent application failure.
        try { client.release(); } catch { /* preserve transaction outcome */ }
      }
    },
    // Do not return "absent means not committed": an outage, lag or rollback
    // can make positive proof unavailable. Only a FULL exact receipt proves it.
    async withReadOnlyTransaction(work) {
      if (typeof work !== "function") throw new TypeError("transaction_callback_required");
      const client = await pool.connect();
      if (!client || typeof client.query !== "function" ||
          typeof client.release !== "function") {
        throw new TypeError("trusted_postgres_client_required");
      }
      let begun = false;
      try {
        await client.query("BEGIN TRANSACTION READ ONLY");
        begun = true;
        await client.query("SET LOCAL statement_timeout = '10000ms'");
        const tx = Object.freeze({
          // Only trusted server-owned authorization implementations can use
          // this connection. Postgres prohibits table writes in this mode.
          authorizedQuery: (sql, params) => client.query(sql, params),
          async readCommittedEvent({ eventId, approvalId, actorId,
            scope, organizationId, expectedRevision, nextRevision, to }) {
            if (![eventId, approvalId, actorId].every(id =>
              typeof id === "string" && UUID.test(id)) ||
              !Number.isSafeInteger(expectedRevision) || expectedRevision < 0 ||
              !Number.isSafeInteger(nextRevision) || nextRevision !== expectedRevision + 1 ||
              !["active", "paused", "maintenance", "lockdown", "offline"].includes(to)) {
              throw new TypeError("invalid_reconciliation_receipt");
            }
            const params = [
              eventId, approvalId, ...scopeParameters(environmentKey, scope, organizationId),
              actorId, String(nextRevision), to, String(expectedRevision)
            ];
            const row = uniqueRow(await client.query(SQL.committedEvent, params));
            return row && {
              eventId: row.id, approvalId: row.approval_id,
              actorId: row.actor_id, from: row.from_mode, to: row.to_mode,
              scope: row.scope, organizationId: row.organization_id,
              expectedRevision: safeInteger(row.expected_revision),
              revision: safeInteger(row.revision)
            };
          }
        });
        const result = await work(tx);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        if (begun) {
          try { await client.query("ROLLBACK"); } catch { /* preserve error */ }
        }
        throw error;
      } finally {
        try { client.release(); } catch { /* preserve read outcome */ }
      }
    }
  });
}
module.exports = { createPostgresOperationalStore };
