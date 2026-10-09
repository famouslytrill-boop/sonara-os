// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { evaluateCustomerCohort } = require("./sonara-customer-cohort-proof.cjs");

const MAX_ORGS = 10_000;
const MAX_EVENTS = 200_000;
const ORG_QUERY = [
  "select id, created_at",
  "from public.organizations",
  "where created_at >= $1::timestamptz and created_at < $2::timestamptz",
  "order by id",
  "limit $3"
].join(" ");
const EVENT_QUERY = [
  "select e.organization_id, e.event_type, e.created_at",
  "from public.activity_events e",
  "inner join public.organizations o on o.id = e.organization_id",
  "where o.created_at >= $1::timestamptz and o.created_at < $2::timestamptz",
  "and e.created_at <= $3::timestamptz",
  "order by e.created_at, e.id",
  "limit $4"
].join(" ");

function fail(code) {
  return Object.freeze({ ok: false, code, report: null });
}

function validResult(result, cap) {
  return result && Array.isArray(result.rows) &&
    Number.isSafeInteger(result.rowCount) &&
    result.rowCount === result.rows.length &&
    result.rows.length <= cap;
}

function postgresTime(value) {
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) throw new Error("invalid_pg_date");
    return value.toISOString();
  }
  return value;
}

// The caller must be an operator-authorized server process. A dedicated
// connection from connect() is essential; a pool.query() method is NOT enough
// because it can route successive SQL statements to different sessions.
// A reviewed, least-privilege reporting role and operator eligibility policy
// are required. This function never returns customer rows or source errors.
//
// This is not a public API and does not provide authentication or billing proof.
async function readCohortFromSnapshot({ connect, from, to, asOf, classifyEligibility } = {}) {
  if (typeof connect !== "function" || typeof classifyEligibility !== "function") {
    return fail("trusted_operator_dependencies_missing");
  }
  const initial = evaluateCustomerCohort({
    organizations: [], activityEvents: [], from, to, asOf,
    source: { authorized: true, organizationsComplete: true, activityEventsComplete: true }
  });
  if (!initial.ok) return fail(initial.code);

  let client = null;
  let started = false;
  let outcome = fail("snapshot_read_failed");
  let cleanupFailed = false;
  try {
    client = await connect();
    if (!client || typeof client.query !== "function" || typeof client.release !== "function") {
      throw new Error("dedicated_client_required");
    }
    // BEGIN can take effect server-side even if the response is lost.
    // Attempt rollback in that case rather than returning a live transaction to a pool.
    started = true;
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await client.query("SET LOCAL statement_timeout = '5s'");
    const state = await client.query("SHOW transaction_read_only");
    if (state?.rows?.length !== 1 || state.rows[0].transaction_read_only !== "on") {
      throw new Error("read_only_not_enforced");
    }

    // The operator cutoff cannot exceed the database transaction's own clock.
    // The transaction snapshot is separate from the activity event-time cutoff:
    // a backfilled historical event may still require explicit provenance review.
    const captured = await client.query("SELECT transaction_timestamp() AS snapshot_at");
    const snapshotAt = postgresTime(captured?.rows?.[0]?.snapshot_at);
    const snapshotMs = typeof snapshotAt === "string" ? Date.parse(snapshotAt) : NaN;
    if (captured?.rows?.length !== 1 || !Number.isFinite(snapshotMs) ||
        Date.parse(asOf) > snapshotMs) {
      throw new Error("snapshot_clock_invalid");
    }

    const orgResult = await client.query(ORG_QUERY, [from, to, MAX_ORGS + 1]);
    if (!validResult(orgResult, MAX_ORGS + 1)) throw new Error("org_result_invalid");
    if (orgResult.rows.length > MAX_ORGS) throw new Error("org_query_truncated");

    const organizations = orgResult.rows.map((row) => {
      const id = row?.id;
      const createdAt = postgresTime(row?.created_at);
      const eligible = classifyEligibility(Object.freeze({ id, created_at: createdAt }));
      if (typeof eligible !== "boolean") throw new Error("eligibility_undefined");
      return { id, created_at: createdAt, eligible };
    });

    const eventsResult = await client.query(EVENT_QUERY, [from, to, asOf, MAX_EVENTS + 1]);
    if (!validResult(eventsResult, MAX_EVENTS + 1)) throw new Error("events_result_invalid");
    if (eventsResult.rows.length > MAX_EVENTS) throw new Error("events_query_truncated");

    const ids = new Set(organizations.map((org) => String(org.id).toLowerCase()));
    const activityEvents = eventsResult.rows.map((event) => {
      if (!ids.has(String(event?.organization_id).toLowerCase())) throw new Error("event_scope_mismatch");
      return {
        organization_id: event.organization_id,
        event_type: event.event_type,
        created_at: postgresTime(event.created_at)
      };
    });

    const evaluated = evaluateCustomerCohort({
      organizations, activityEvents, from, to, asOf,
      source: { authorized: true, organizationsComplete: true, activityEventsComplete: true }
    });
    outcome = evaluated.ok
      ? Object.freeze({ ...evaluated, sourceConsistency: "dedicated_repeatable_read_read_only_transaction", snapshotCapturedAt: new Date(snapshotMs).toISOString() })
      : fail(evaluated.code);
  } catch {
    outcome = fail("snapshot_read_failed");
  } finally {
    if (started) {
      try {
        await client.query("ROLLBACK");
      } catch {
        cleanupFailed = true;
      }
    }
    if (client && typeof client.release === "function") {
      try {
        await client.release(cleanupFailed ? new Error("rollback_failed") : undefined);
      } catch {
        cleanupFailed = true;
      }
    }
  }
  if (cleanupFailed) return fail("snapshot_cleanup_failed");
  return outcome;
}

module.exports = { readCohortFromSnapshot };
