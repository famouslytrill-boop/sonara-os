// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Server-side adapter only. No credentials, network calls or worker starts on
// import. RPC is injected from an authenticated service_role-only server client.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
function rpcData(reply) {
  if (!reply || typeof reply !== "object" || reply.error) throw Error("autonomic_retry_rpc_failed");
  return reply.data;
}
function validJob(job) {
  if (!job || typeof job.resourceKey !== "string") return false;
  let resource;
  try { resource = JSON.parse(job.resourceKey); } catch { return false; }
  return Array.isArray(resource) && resource.length === 4 &&
    resource[0] === "organization" && resource[1] === job.organizationId &&
    resource[2] === "retry_idempotent" && ID.test(resource[3] || "") &&
    job.resourceKey === JSON.stringify(resource) &&
    job.action === "retry_idempotent" && UUID.test(job.organizationId || "") &&
    job.resourceKey.length <= 1024 &&
    ID.test(job.operationId || "") && ID.test(job.incidentId || "") &&
    Number.isInteger(job.attempt) && job.attempt >= 0 && job.attempt <= 2 &&
    typeof job.dedupeKey === "string" && job.dedupeKey.length <= 2048 &&
    Number.isSafeInteger(job.notBeforeMs) && Number.isSafeInteger(job.deadlineAtMs) &&
    job.notBeforeMs + 1000 < job.deadlineAtMs &&
    job.dedupeKey === JSON.stringify([job.resourceKey, job.operationId, job.attempt]);
}
function createPostgresDelayedRetryStore({ rpc } = {}) {
  if (typeof rpc !== "function") throw TypeError("Protected server-side RPC required");
  return Object.freeze({
    scheduler: Object.freeze({
      async schedule(job) {
        let valid = false;
        try { valid = validJob(job); } catch { /* malformed resource JSON */ }
        if (!valid) throw Error("autonomic_retry_envelope_invalid");
        const data = rpcData(await rpc("sonara_schedule_autonomic_retry", {
          p_resource_key: job.resourceKey, p_organization_id: job.organizationId,
          p_operation_id: job.operationId, p_incident_id: job.incidentId,
          p_attempt: job.attempt, p_dedupe_key: job.dedupeKey,
          p_not_before: new Date(job.notBeforeMs).toISOString(),
          p_deadline_at: new Date(job.deadlineAtMs).toISOString()
        }));
        if (!Array.isArray(data) || data.length !== 1 ||
            typeof data[0]?.persisted !== "boolean" || typeof data[0]?.duplicate !== "boolean") {
          throw Error("autonomic_retry_schedule_response_invalid");
        }
        if (data[0].duplicate === true && data[0].persisted === false) {
          return { duplicate: true };
        }
        const storedTime = Date.parse(data[0].not_before);
        if (data[0].persisted === true && data[0].duplicate === false &&
            Number.isSafeInteger(storedTime) && storedTime === job.notBeforeMs) {
          return { persisted: true, notBeforeMs: storedTime };
        }
        throw Error("autonomic_retry_schedule_not_confirmed");
      }
    }),
    worker: Object.freeze({
      async claimDue() {
        const data = rpcData(await rpc("sonara_claim_due_autonomic_retry", {}));
        if (!Array.isArray(data)) throw Error("autonomic_retry_claim_response_invalid");
        if (data.length === 0) return null;
        if (data.length !== 1) throw Error("autonomic_retry_claim_count_invalid");
        const r = data[0];
        const deadlineAtMs = Date.parse(r.deadline_at);
        const fencingToken = Number(r.fencing_token);
        let scope;
        try { scope = JSON.parse(r.resource_key); } catch { throw Error("autonomic_retry_resource_invalid"); }
        if (!Array.isArray(scope) || scope.length !== 4 ||
            scope[0] !== "organization" || scope[1] !== r.organization_id ||
            scope[2] !== "retry_idempotent" || !ID.test(scope[3] || "") ||
            JSON.stringify(scope) !== r.resource_key) {
          throw Error("autonomic_retry_resource_invalid");
        }
        if (!UUID.test(r.job_id || "") || !UUID.test(r.claim_token || "") ||
            !UUID.test(r.organization_id || "") || !ID.test(r.operation_id || "") ||
            !Number.isInteger(r.attempt) || r.attempt < 0 || r.attempt > 2 ||
            !Number.isSafeInteger(fencingToken) || fencingToken < 1 ||
            !Number.isSafeInteger(deadlineAtMs) ||
            typeof r.resource_key !== "string") {
          throw Error("autonomic_retry_claim_invalid");
        }
        return Object.freeze({
          jobId: r.job_id, claimToken: r.claim_token, fencingToken,
          resourceKey: r.resource_key, organizationId: r.organization_id,
          operationId: r.operation_id, attempt: r.attempt, deadlineAtMs
        });
      },
      async complete({ jobId, claimToken, outcome }) {
        if (!UUID.test(jobId || "") || !UUID.test(claimToken || "") ||
            !["verified", "unverified", "failed"].includes(outcome)) {
          throw Error("autonomic_retry_completion_invalid");
        }
        return rpcData(await rpc("sonara_complete_autonomic_retry", {
          p_job_id: jobId, p_claim_token: claimToken, p_outcome: outcome
        })) === true;
      }
    })
  });
}
module.exports = { createPostgresDelayedRetryStore };
