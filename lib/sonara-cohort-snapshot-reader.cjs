// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { evaluateCustomerCohort } = require("./sonara-customer-cohort-proof.cjs");
const { verifyCohortRosterAttestation } = require("./sonara-cohort-roster-attestation.cjs");

const MAX_ORGS = 10_000;
const MAX_EVENTS = 200_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REPORT_ROLE_RE = /^[a-z][a-z0-9_]{2,62}$/;
const RESERVED_ROLES = new Set([
  "postgres", "service_role", "anon", "authenticated", "authenticator",
  "supabase_admin", "supabase_auth_admin", "supabase_storage_admin"
]);
const ROLE_QUERY = [
  "select current_user::text as role_name, session_user::text as session_role,",
  "r.rolsuper as role_superuser, r.rolbypassrls as role_bypasses_rls,",
  "row_security_active('public.organizations'::regclass) as organizations_rls_active,",
  "row_security_active('public.activity_events'::regclass) as activity_events_rls_active",
  "from pg_catalog.pg_roles r where r.rolname = current_user"
].join(" ");
const ORG_QUERY = [
  "select id, created_at",
  "from public.organizations",
  "where created_at >= $1::timestamptz and created_at < $2::timestamptz",
  "and id = any($3::uuid[])",
  "order by id",
  "limit $4"
].join(" ");
const EVENT_QUERY = [
  "select e.organization_id, e.event_type, e.created_at",
  "from public.activity_events e",
  "inner join public.organizations o on o.id = e.organization_id",
  "where o.created_at >= $1::timestamptz and o.created_at < $2::timestamptz",
  "and e.created_at <= $3::timestamptz",
  "and e.organization_id = any($4::uuid[])",
  "order by e.created_at, e.id",
  "limit $5"
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
// are required. Refuse service/superuser/RLS-bypass credentials even when
// READ ONLY is enabled. RLS-active alone does not prove restrictive policies:
// real two-tenant adversarial authorization proof remains a separate release gate. This function never returns customer rows or source errors.
//
// This is not a public API and does not provide authentication or billing proof.
async function readCohortFromSnapshot({ connect, from, to, asOf, classifyEligibility, approvedReportingRole, expectedOrganizationIds, rosterAttestation, trustedRosterPublicKeys, sourceEvidenceBytes, approvedSourceQuerySha256 } = {}) {
  if (typeof connect !== "function" || typeof classifyEligibility !== "function" ||
      typeof approvedReportingRole !== "string" || !REPORT_ROLE_RE.test(approvedReportingRole) ||
      RESERVED_ROLES.has(approvedReportingRole)) {
    return fail("trusted_operator_dependencies_missing");
  }
  // Source completeness cannot be inferred from a SELECT with RLS: a policy
  // can silently hide rows. Require a separately approved, exact membership
  // roster and bind it to BOTH reads. This is a completeness assertion, not
  // proof that the operator's roster was independently authenticated.
  if (!Array.isArray(expectedOrganizationIds) || expectedOrganizationIds.length < 1 ||
      expectedOrganizationIds.length > MAX_ORGS ||
      expectedOrganizationIds.some((id) => typeof id !== "string" || !UUID_RE.test(id))) {
    return fail("approved_cohort_roster_invalid");
  }
  const expectedIds = expectedOrganizationIds.map((id) => id.toLowerCase());
  const expectedSet = new Set(expectedIds);
  if (expectedSet.size !== expectedIds.length) return fail("approved_cohort_roster_invalid");

  const rosterApproval = verifyCohortRosterAttestation({
    attestation: rosterAttestation,
    trustedKeys: trustedRosterPublicKeys,
    approvedReportingRole, expectedOrganizationIds: expectedIds, sourceEvidenceBytes,
    approvedSourceQuerySha256, from, to, asOf
  });
  if (!rosterApproval.ok) return fail(rosterApproval.code);

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

    // The database session identity must exactly match the operator-approved
    // dedicated reporting principal, not merely a SET ROLE from privileged
    // session credentials; both tenant tables must actually enforce RLS.
    const roles = await client.query(ROLE_QUERY);
    const identity = roles?.rows?.[0];
    if (roles?.rows?.length !== 1 ||
        identity?.role_name !== approvedReportingRole ||
        identity?.session_role !== approvedReportingRole ||
        identity?.role_superuser !== false ||
        identity?.role_bypasses_rls !== false ||
        identity?.organizations_rls_active !== true ||
        identity?.activity_events_rls_active !== true) {
      throw new Error("untrusted_reporting_database_role");
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

    const orgResult = await client.query(ORG_QUERY, [from, to, expectedIds, MAX_ORGS + 1]);
    if (!validResult(orgResult, MAX_ORGS + 1)) throw new Error("org_result_invalid");
    if (orgResult.rows.length > MAX_ORGS) throw new Error("org_query_truncated");
    const observedIds = new Set();
    for (const row of orgResult.rows) {
      const id = String(row?.id || "").toLowerCase();
      if (!expectedSet.has(id) || observedIds.has(id)) throw new Error("org_roster_mismatch");
      observedIds.add(id);
    }
    if (observedIds.size !== expectedSet.size) throw new Error("org_roster_incomplete");

    const organizations = orgResult.rows.map((row) => {
      const id = row?.id;
      const createdAt = postgresTime(row?.created_at);
      const eligible = classifyEligibility(Object.freeze({ id, created_at: createdAt }));
      if (typeof eligible !== "boolean") throw new Error("eligibility_undefined");
      return { id, created_at: createdAt, eligible };
    });

    const eventsResult = await client.query(EVENT_QUERY, [from, to, asOf, expectedIds, MAX_EVENTS + 1]);
    if (!validResult(eventsResult, MAX_EVENTS + 1)) throw new Error("events_result_invalid");
    if (eventsResult.rows.length > MAX_EVENTS) throw new Error("events_query_truncated");

    const ids = expectedSet;
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
      ? Object.freeze({ ...evaluated, sourceConsistency: "dedicated_repeatable_read_read_only_transaction", snapshotCapturedAt: new Date(snapshotMs).toISOString(), authorizedRosterSize: expectedSet.size, rosterEvidenceSha256: rosterApproval.evidenceSha256, rosterApprovalKeyId: rosterApproval.keyId })
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
