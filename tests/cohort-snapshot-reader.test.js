// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert = require("node:assert/strict");
const { readCohortFromSnapshot } = require("../lib/sonara-cohort-snapshot-reader.cjs");

const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";
const from = "2026-09-01T00:00:00.000Z";
const to = "2026-09-02T00:00:00.000Z";
const asOf = "2026-09-15T00:00:00.000Z";
const create = "2026-09-01T10:00:00.000Z";

function fakeClient({ organizations = [{ id: ID_A, created_at: create }],
  events = [
    { organization_id: ID_A, event_type: "account.organization_created", created_at: create },
    { organization_id: ID_A, event_type: "creator_studio.output_downloaded", created_at: "2026-09-01T10:12:00.000Z" }
  ], readOnly = "on", failOn = null, mismatch = false, rollbackFails = false,
  dbRole = "sonara_cohort_reader", sessionRole = dbRole, roleSuper = false,
  roleBypass = false, orgRls = true, activityRls = true } = {}) {
  const calls = [];
  const client = {
    calls,
    releaseCalled: false,
    release: function () { this.releaseCalled = true; },
    async query(sql, params) {
      calls.push({ sql, params });
      if (failOn && sql.includes(failOn)) throw new Error("sensitive_detail_must_not_leak");
      if (sql.startsWith("BEGIN") || sql.startsWith("SET LOCAL")) return { rows: [], rowCount: 0 };
      if (sql === "SHOW transaction_read_only") {
        return { rows: [{ transaction_read_only: readOnly }], rowCount: 1 };
      }
      if (sql.includes("from pg_catalog.pg_roles r where r.rolname = current_user")) {
        return { rows: [{
          role_name: dbRole, session_role: sessionRole,
          role_superuser: roleSuper, role_bypasses_rls: roleBypass,
          organizations_rls_active: orgRls, activity_events_rls_active: activityRls
        }], rowCount: 1 };
      }
      if (sql === "SELECT transaction_timestamp() AS snapshot_at") {
        return { rows: [{ snapshot_at: "2026-10-08T22:00:00.000Z" }], rowCount: 1 };
      }
      if (sql.startsWith("select id, created_at")) {
        return { rows: organizations, rowCount: mismatch ? organizations.length + 1 : organizations.length };
      }
      if (sql.startsWith("select e.organization_id")) {
        return { rows: events, rowCount: events.length };
      }
      if (sql === "ROLLBACK") {
        if (rollbackFails) throw new Error("rollback_failure_secret");
        return { rows: [], rowCount: 0 };
      }
      throw new Error("unexpected query " + sql);
    }
  };
  return client;
}

function report(client, extra = {}) {
  return readCohortFromSnapshot({
    connect: async () => client,
    classifyEligibility: () => true,
    approvedReportingRole: "sonara_cohort_reader",
    from, to, asOf, ...extra
  });
}

describe("server-only customer cohort snapshot contract", () => {
  it("reads both sources inside one verified read-only repeatable-read session and rolls back", async () => {
    const client = fakeClient();
    const result = await report(client);
    assert.equal(result.ok, true);
    assert.equal(result.report.eligibleOrganizations, 1);
    assert.equal(result.report.activatedOrganizations, 1);
    assert.equal(result.report.firstValueOrganizations, 1);
    assert.equal(result.report.verifiedPaidConversionRate, null);
    assert.equal(result.sourceConsistency, "dedicated_repeatable_read_read_only_transaction");
    assert.equal(result.snapshotCapturedAt, "2026-10-08T22:00:00.000Z");
    assert.equal(client.calls[0].sql, "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    assert.ok(client.calls.some(({ sql }) => sql.includes("row_security_active('public.organizations'")));
    assert.ok(client.calls.some(({ sql }) => sql.includes("row_security_active('public.activity_events'")));
    assert.equal(client.calls.at(-1).sql, "ROLLBACK");
    assert.equal(client.releaseCalled, true);
    const selects = client.calls.filter((call) => call.sql.startsWith("select id, created_at") || call.sql.startsWith("select e.organization_id"));
    assert.equal(selects.length, 2);
    assert.ok(selects.every((call) => !/insert|update|delete/i.test(call.sql)));
    assert.ok(selects.every((call) => call.params[0] === from && call.params[1] === to));
    assert.equal(JSON.stringify(result).includes(ID_A), false);
  });

  it("does not permit a cutoff beyond the authoritative database transaction clock", async () => {
    const client = fakeClient();
    const result = await report(client, { asOf: "2026-10-09T00:00:00.000Z" });
    assert.equal(result.code, "snapshot_read_failed");
    assert.equal(client.calls.at(-1).sql, "ROLLBACK");
    assert.equal(client.releaseCalled, true);
  });

  it("does not connect with invalid windows or missing trusted policy", async () => {
    let connections = 0;
    const connect = async () => { connections += 1; return fakeClient(); };
    const invalid = await readCohortFromSnapshot({ connect, classifyEligibility: () => true, approvedReportingRole: "sonara_cohort_reader", from, to, asOf: from });
    assert.equal(invalid.code, "observation_window_invalid");
    assert.equal(connections, 0);
    const missing = await readCohortFromSnapshot({ connect, from, to, asOf });
    assert.equal(missing.code, "trusted_operator_dependencies_missing");
    assert.equal(connections, 0);
  });

  it("rejects privileged PostgreSQL reporting identities before source SELECTs", async () => {
    for (const overrides of [
      { dbRole: "postgres", roleBypass: true },
      { dbRole: "sonara_cohort_reader", roleBypass: true },
      { dbRole: "sonara_cohort_reader", roleSuper: true },
      { dbRole: "sonara_cohort_reader", sessionRole: "postgres" },
      { dbRole: "sonara_cohort_reader", orgRls: false },
      { dbRole: "sonara_cohort_reader", activityRls: false },
      { dbRole: "another_reader" }
    ]) {
      const client = fakeClient(overrides);
      const result = await report(client);
      assert.equal(result.code, "snapshot_read_failed");
      assert.equal(client.calls.at(-1).sql, "ROLLBACK");
      assert.equal(client.releaseCalled, true);
      assert.equal(client.calls.some(({ sql }) => sql.startsWith("select id, created_at")), false);
    }
  });

  it("refuses missing or forbidden approved role before opening database connection", async () => {
    let connections = 0;
    const connect = async () => { connections += 1; return fakeClient(); };
    for (const role of [undefined, "postgres", "service_role", "authenticated", "BAD;DROP"]) {
      const result = await readCohortFromSnapshot({
        connect, classifyEligibility: () => true, from, to, asOf, approvedReportingRole: role
      });
      assert.equal(result.code, "trusted_operator_dependencies_missing");
    }
    assert.equal(connections, 0);
  });

  it("refuses a read-write session and cleans up", async () => {
    const client = fakeClient({ readOnly: "off" });
    const result = await report(client);
    assert.equal(result.code, "snapshot_read_failed");
    assert.equal(client.calls.at(-1).sql, "ROLLBACK");
    assert.equal(client.releaseCalled, true);
  });

  it("rejects incomplete driver results, overly large datasets and cross-tenant rows", async () => {
    const badCount = fakeClient({ mismatch: true });
    assert.equal((await report(badCount)).ok, false);
    assert.equal(badCount.releaseCalled, true);
    const outsider = fakeClient({ events: [
      { organization_id: ID_B, event_type: "account.organization_created", created_at: create }
    ] });
    assert.equal((await report(outsider)).code, "snapshot_read_failed");
    assert.equal(outsider.calls.at(-1).sql, "ROLLBACK");
    const tooMany = fakeClient({ organizations: Array(10_001).fill({ id: ID_A, created_at: create }), events: [] });
    assert.equal((await report(tooMany)).ok, false);
  });

  it("requires reviewed, synchronous eligibility classification", async () => {
    const client = fakeClient();
    const result = await report(client, { classifyEligibility: () => Promise.resolve(true) });
    assert.equal(result.ok, false);
    assert.equal(client.releaseCalled, true);
    const excluded = fakeClient();
    const allowed = await report(excluded, { classifyEligibility: () => false });
    assert.equal(allowed.ok, true);
    assert.equal(allowed.report.eligibleOrganizations, 0);
    assert.equal(allowed.report.activationRate, null);
  });

  it("never leaks a database exception and still cleans up after a failed read", async () => {
    const client = fakeClient({ failOn: "select e.organization_id" });
    const result = await report(client);
    assert.equal(result.code, "snapshot_read_failed");
    assert.equal(JSON.stringify(result).includes("sensitive_detail_must_not_leak"), false);
    assert.equal(client.calls.at(-1).sql, "ROLLBACK");
    assert.equal(client.releaseCalled, true);
  });

  it("attempts rollback after an ambiguous BEGIN failure", async () => {
    const client = fakeClient({ failOn: "BEGIN" });
    const result = await report(client);
    assert.equal(result.ok, false);
    assert.equal(client.calls.at(-1).sql, "ROLLBACK");
    assert.equal(client.releaseCalled, true);
  });

  it("refuses success if rollback itself fails", async () => {
    const client = fakeClient({ rollbackFails: true });
    const result = await report(client);
    assert.equal(result.code, "snapshot_cleanup_failed");
    assert.equal(client.releaseCalled, true);
  });

  it("accepts PostgreSQL timestamp objects without exposing raw source rows", async () => {
    const client = fakeClient({ organizations: [{ id: ID_A, created_at: new Date(create) }],
      events: [{ organization_id: ID_A, event_type: "account.organization_created", created_at: new Date(create) }] });
    const result = await report(client);
    assert.equal(result.ok, true);
    assert.equal(result.report.activatedOrganizations, 1);
  });
});
