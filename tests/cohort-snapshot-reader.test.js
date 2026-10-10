// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert = require("node:assert/strict");
const { createHash, generateKeyPairSync, sign } = require("node:crypto");
const { readCohortFromSnapshot } = require("../lib/sonara-cohort-snapshot-reader.cjs");
const { verifyCohortRosterAttestation } = require("../lib/sonara-cohort-roster-attestation.cjs");

const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";
const from = "2026-09-01T00:00:00.000Z";
const to = "2026-09-02T00:00:00.000Z";
const asOf = "2026-09-15T00:00:00.000Z";
const create = "2026-09-01T10:00:00.000Z";
const { publicKey: rosterPublic, privateKey: rosterPrivate } = generateKeyPairSync("ed25519");
const trustStore = { "ops_test_key": rosterPublic };

function sourceManifest({
  ids = [ID_A], role = "sonara_cohort_reader", start = from, end = to,
  cutoff = asOf, exportedAt = "2026-10-01T00:00:00.000Z",
  complete = true, totalOrganizations = ids.length,
  queryHash = "b".repeat(64)
} = {}) {
  return Buffer.from(JSON.stringify({
    asOf: cutoff, audience: "sonara.cohort.snapshot.v1", complete,
    exportedAt, from: start, organizationIds: ids.map((id) => id.toLowerCase()).sort(),
    reportingRole: role, scope: "eligible-organization-creation-cohort-v1",
    sourceQuerySha256: queryHash, to: end, totalOrganizations
  }));
}

function signedRoster({ ids = [ID_A], role = "sonara_cohort_reader",
  start = from, end = to, cutoff = asOf, sourceEvidenceBytes,
  issuedAt = new Date(Date.now() - 60_000).toISOString(),
  expiresAt = new Date(Date.now() + 3_600_000).toISOString() } = {}) {
  const evidence = sourceEvidenceBytes || sourceManifest({
    ids, role, start, end, cutoff
  });
  const payload = {
    asOf: cutoff, audience: "sonara.cohort.snapshot.v1",
    evidenceSha256: createHash("sha256").update(evidence).digest("hex"),
    expiresAt, from: start, issuedAt,
    organizationIds: ids.map((id) => id.toLowerCase()).sort(),
    reportingRole: role, to: end
  };
  const buffer = Buffer.from(JSON.stringify(payload));
  return {
    keyId: "ops_test_key",
    payloadB64: buffer.toString("base64url"),
    signatureB64: sign(null, buffer, rosterPrivate).toString("base64url")
  };
}

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
  const options = {
    connect: async () => client,
    classifyEligibility: () => true,
    approvedReportingRole: "sonara_cohort_reader",
    expectedOrganizationIds: [ID_A],
    approvedSourceQuerySha256: "b".repeat(64),
    from, to, asOf, ...extra
  };
  if (options.sourceEvidenceBytes === undefined) {
    options.sourceEvidenceBytes = sourceManifest({
      ids: options.expectedOrganizationIds, role: options.approvedReportingRole,
      start: options.from, end: options.to, cutoff: options.asOf
    });
  }
  if (options.rosterAttestation === undefined) {
    options.rosterAttestation = signedRoster({
      sourceEvidenceBytes: options.sourceEvidenceBytes,
      ids: options.expectedOrganizationIds,
      role: options.approvedReportingRole,
      start: options.from, end: options.to, cutoff: options.asOf
    });
  }
  if (options.trustedRosterPublicKeys === undefined) options.trustedRosterPublicKeys = trustStore;
  return readCohortFromSnapshot(options);
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
    assert.equal(result.authorizedRosterSize, 1);
    assert.equal(result.rosterEvidenceSha256,
      createHash("sha256").update(sourceManifest()).digest("hex"));
    assert.equal(result.rosterApprovalKeyId, "ops_test_key");
    assert.equal(client.calls[0].sql, "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    assert.ok(client.calls.some(({ sql }) => sql.includes("row_security_active('public.organizations'")));
    assert.ok(client.calls.some(({ sql }) => sql.includes("row_security_active('public.activity_events'")));
    assert.equal(client.calls.at(-1).sql, "ROLLBACK");
    assert.equal(client.releaseCalled, true);
    const selects = client.calls.filter((call) => call.sql.startsWith("select id, created_at") || call.sql.startsWith("select e.organization_id"));
    assert.equal(selects.length, 2);
    assert.ok(selects.every((call) => !/insert|update|delete/i.test(call.sql)));
    assert.ok(selects.every((call) => call.params[0] === from && call.params[1] === to));
    assert.ok(selects.every((call) => call.sql.includes("= any(")));
    assert.deepEqual(selects[0].params[2], [ID_A]);
    assert.deepEqual(selects[1].params[3], [ID_A]);
    assert.equal(JSON.stringify(result).includes(ID_A), false);
  });

  it("does not permit a cutoff beyond the authoritative database transaction clock", async () => {
    const client = fakeClient();
    // The manifest must have been exported AFTER its observation cutoff but
    // BEFORE its signer issued the approval; only the DB snapshot clock fails.
    const result = await report(client, {
      asOf: "2026-10-08T23:00:00.000Z",
      sourceEvidenceBytes: sourceManifest({
        cutoff: "2026-10-08T23:00:00.000Z",
        exportedAt: "2026-10-09T00:00:00.000Z"
      })
    });
    assert.equal(result.code, "snapshot_read_failed");
    assert.equal(client.calls.at(-1).sql, "ROLLBACK");
    assert.equal(client.releaseCalled, true);
  });

  it("does not connect with invalid windows or missing trusted policy", async () => {
    let connections = 0;
    const connect = async () => { connections += 1; return fakeClient(); };
    const invalid = await readCohortFromSnapshot({ connect, classifyEligibility: () => true, approvedReportingRole: "sonara_cohort_reader", expectedOrganizationIds: [ID_A], rosterAttestation: signedRoster({ cutoff: from }), sourceEvidenceBytes: sourceManifest({ cutoff: from }), trustedRosterPublicKeys: trustStore, from, to, asOf: from });
    // Signed evidence now rejects impossible time windows before evaluator input.
    assert.equal(invalid.code, "roster_attestation_invalid");
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

  it("refuses absent, duplicate, invalid or oversized organization-roster evidence before connecting", async () => {
    let connected = 0;
    const connect = async () => { connected += 1; return fakeClient(); };
    for (const expectedOrganizationIds of [undefined, [], [ID_A, ID_A], [ID_A, ID_A.toUpperCase()], ["garbage"], Array(10_001).fill(ID_A)]) {
      const result = await readCohortFromSnapshot({ connect, classifyEligibility: () => true,
        approvedReportingRole: "sonara_cohort_reader", expectedOrganizationIds, from, to, asOf });
      assert.equal(result.code, "approved_cohort_roster_invalid");
    }
    assert.equal(connected, 0);
  });

  it("rejects incomplete or extra organization rows under otherwise valid RLS identity", async () => {
    const missing = fakeClient({ organizations: [] });
    assert.equal((await report(missing)).code, "snapshot_read_failed");
    assert.equal(missing.calls.at(-1).sql, "ROLLBACK");
    const extra = fakeClient({ organizations: [{ id: ID_A, created_at: create }, { id: ID_B, created_at: create }] });
    assert.equal((await report(extra)).code, "snapshot_read_failed");
    const duplicate = fakeClient({ organizations: [{ id: ID_A, created_at: create }, { id: ID_A, created_at: create }] });
    assert.equal((await report(duplicate)).code, "snapshot_read_failed");
  });

  it("preserves exact completeness when reading a reviewed multi-organization roster", async () => {
    const client = fakeClient({ organizations: [{ id: ID_A, created_at: create }, { id: ID_B, created_at: create }],
      events: [{ organization_id: ID_A, event_type: "account.organization_created", created_at: create },
        { organization_id: ID_B, event_type: "account.organization_created", created_at: create }] });
    const result = await report(client, { expectedOrganizationIds: [ID_A, ID_B] });
    assert.equal(result.ok, true);
    assert.equal(result.authorizedRosterSize, 2);
    assert.equal(result.report.eligibleOrganizations, 2);
    assert.equal(result.report.activatedOrganizations, 2);
    assert.equal(JSON.stringify(result).includes(ID_A), false);
    assert.equal(JSON.stringify(result).includes(ID_B), false);
  });

  it("refuses missing, forged, tampered, rotated and expired approval signatures before DB access", async () => {
    let connections = 0;
    const client = fakeClient();
    const connect = async () => { connections += 1; return client; };
    const base = { connect, classifyEligibility: () => true,
      approvedReportingRole: "sonara_cohort_reader", expectedOrganizationIds: [ID_A],
      trustedRosterPublicKeys: trustStore, sourceEvidenceBytes: sourceManifest(),
      approvedSourceQuerySha256: "b".repeat(64), from, to, asOf };
    const valid = signedRoster();
    const corrupt = { ...valid, signatureB64: "A".repeat(86) };
    const forged = { ...valid, payloadB64: signedRoster({ ids: [ID_B] }).payloadB64 };
    const wrongAudience = signedRoster({ role: "other_reporting_role" });
    const expired = signedRoster({ issuedAt: "2026-09-01T00:00:00.000Z",
      expiresAt: "2026-09-02T00:00:00.000Z" });
    for (const attestation of [undefined, corrupt, forged, wrongAudience, expired,
      { ...valid, keyId: "untrusted_key" }, { ...valid, signatureB64: "invalid" }]) {
      const result = await readCohortFromSnapshot({ ...base, rosterAttestation: attestation });
      assert.equal(result.code, "roster_attestation_invalid");
    }
    const mismatchedTime = await readCohortFromSnapshot({ ...base,
      to: "2026-09-03T00:00:00.000Z", rosterAttestation: valid });
    assert.equal(mismatchedTime.code, "roster_attestation_invalid");
    assert.equal(connections, 0);
  });

  it("verifies Ed25519 using public KeyObject or PEM but rejects private key custody", () => {
    const attestation = signedRoster();
    const base = { attestation, approvedReportingRole: "sonara_cohort_reader",
      expectedOrganizationIds: [ID_A], sourceEvidenceBytes: sourceManifest(),
      approvedSourceQuerySha256: "b".repeat(64), from, to, asOf };
    assert.equal(verifyCohortRosterAttestation({
      ...base, trustedKeys: { ops_test_key: rosterPublic }
    }).ok, true);
    assert.equal(verifyCohortRosterAttestation({
      ...base, trustedKeys: { ops_test_key: rosterPublic.export({ format: "pem", type: "spki" }) }
    }).ok, true);
    assert.equal(verifyCohortRosterAttestation({
      ...base, trustedKeys: { ops_test_key: rosterPrivate }
    }).ok, false);
    assert.equal(verifyCohortRosterAttestation({
      ...base, trustedKeys: { ops_test_key: rosterPrivate.export({ format: "pem", type: "pkcs8" }) }
    }).ok, false);
  });

  it("rejects untrusted approval fields, clock replay, invalid issuer evidence and signing overlong", () => {
    const payload = {
      asOf, audience: "sonara.cohort.snapshot.v1", evidenceSha256: "a".repeat(64),
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      from, issuedAt: new Date(Date.now() - 60_000).toISOString(),
      organizationIds: [ID_A], reportingRole: "sonara_cohort_reader", to
    };
    const opts = { trustedKeys: trustStore, approvedReportingRole: "sonara_cohort_reader",
      expectedOrganizationIds: [ID_A], sourceEvidenceBytes: sourceManifest(), from, to, asOf };
    const seal = (claims) => {
      const bytes = Buffer.from(JSON.stringify(claims));
      return { keyId: "ops_test_key", payloadB64: bytes.toString("base64url"),
        signatureB64: sign(null, bytes, rosterPrivate).toString("base64url") };
    };
    for (const edited of [
      { ...payload, arbitraryScope: true },
      { ...payload, evidenceSha256: "not-a-sha256" },
      { ...payload, issuedAt: new Date(Date.now() + 60_000).toISOString() },
      { ...payload, expiresAt: new Date(Date.now() + 4 * 86_400_000).toISOString() },
      { ...payload, audience: "sonara.other.purpose" }
    ]) {
      assert.equal(verifyCohortRosterAttestation({ ...opts,
        attestation: seal(edited) }).ok, false);
    }
  });

  it("requires the actual evidence bytes matching the signed SHA-256 before connecting", async () => {
    let connections = 0;
    const connect = async () => { connections += 1; return fakeClient(); };
    const original = sourceManifest();
    const signed = signedRoster({ sourceEvidenceBytes: original });
    const options = { connect, classifyEligibility: () => true,
      approvedReportingRole: "sonara_cohort_reader", expectedOrganizationIds: [ID_A],
      rosterAttestation: signed, trustedRosterPublicKeys: trustStore,
      approvedSourceQuerySha256: "b".repeat(64), from, to, asOf };
    for (const evidence of [
      undefined, Buffer.alloc(0),
      Buffer.from(original.toString("utf8") + " "),
      sourceManifest({ complete: false }),
      sourceManifest({ totalOrganizations: 2 }),
      sourceManifest({ queryHash: "wrong" }),
      sourceManifest({ ids: [ID_B] })
    ]) {
      const result = await readCohortFromSnapshot({ ...options, sourceEvidenceBytes: evidence });
      assert.equal(result.code, "roster_attestation_invalid");
    }
    assert.equal(connections, 0);
  });

  it("rejects internally inconsistent evidence even with its own valid matching signature", async () => {
    for (const evidence of [
      sourceManifest({ complete: false }),
      sourceManifest({ totalOrganizations: 5 }),
      sourceManifest({ queryHash: "invalid" }),
      sourceManifest({ exportedAt: "2026-08-01T00:00:00.000Z" }),
      sourceManifest({ exportedAt: "2040-10-01T00:00:00.000Z" })
    ]) {
      const result = await report(fakeClient(), { sourceEvidenceBytes: evidence });
      assert.equal(result.code, "roster_attestation_invalid");
    }
  });

  it("rejects signed but unreviewed source-query hashes before the database connection", async () => {
    let connections = 0;
    const sourceEvidenceBytes = sourceManifest({ queryHash: "c".repeat(64) });
    const opts = {
      connect: async () => { connections++; return fakeClient(); },
      classifyEligibility: () => true,
      approvedReportingRole: "sonara_cohort_reader",
      expectedOrganizationIds: [ID_A],
      trustedRosterPublicKeys: trustStore,
      rosterAttestation: signedRoster({ sourceEvidenceBytes }),
      sourceEvidenceBytes, from, to, asOf
    };
    for (const reviewedHash of [undefined, "b".repeat(64), "INVALID"]) {
      const result = await readCohortFromSnapshot({
        ...opts, approvedSourceQuerySha256: reviewedHash
      });
      assert.equal(result.code, "roster_attestation_invalid");
    }
    assert.equal(connections, 0);
  });

  it("rejects noncanonical source and approval JSON even when correctly signed", async () => {
    const original = sourceManifest().toString("utf8");
    const signedManifest = (sourceEvidenceBytes) =>
      signedRoster({ sourceEvidenceBytes });
    for (const text of [
      original.replace('"complete":true', '"complete":false,"complete":true'),
      original.replace('"complete":true', '"complete" : true')
    ]) {
      const sourceEvidenceBytes = Buffer.from(text);
      const result = await report(fakeClient(), {
        sourceEvidenceBytes, rosterAttestation: signedManifest(sourceEvidenceBytes)
      });
      assert.equal(result.code, "roster_attestation_invalid");
    }
    const sourceEvidenceBytes = sourceManifest();
    const approval = signedRoster({ sourceEvidenceBytes });
    const decoded = Buffer.from(approval.payloadB64, "base64url").toString("utf8");
    const bytes = Buffer.from(decoded.replace('"audience":', '"audience":"other","audience":'));
    assert.equal(verifyCohortRosterAttestation({
      attestation: { keyId: approval.keyId,
        payloadB64: bytes.toString("base64url"),
        signatureB64: sign(null, bytes, rosterPrivate).toString("base64url") },
      trustedKeys: trustStore, approvedReportingRole: "sonara_cohort_reader",
      approvedSourceQuerySha256: "b".repeat(64),
      expectedOrganizationIds: [ID_A], sourceEvidenceBytes, from, to, asOf
    }).ok, false);
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
