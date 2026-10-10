// Copyright (c) 2026 SONARA Industries. All rights reserved.
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const probe = fs.readFileSync(path.join(root, "tests/sql/p1-rls-initplan-policy-dedup-rollback.sql"), "utf8");
const hardening = fs.readFileSync(path.join(root,
  "supabase/migrations/20261008100000_tighten_service_role_rls_policies.sql"), "utf8");

describe("P1 hardened RLS replay probe is consistent with later migration history", () => {
  it("keeps exactly 25 named policy expectations, including 21 service-role and four ownership checks", () => {
    const expected = probe.split("INSERT INTO expected_rls_p1 VALUES")[1]?.split(";")[0] || "";
    const serviceRows = expected.match(/'\{service_role\}', 'ALL', 'true', 'true'\)/g) || [];
    const ownerRows = expected.match(/'\{authenticated\}', 'SELECT', '\(\( SELECT auth\.uid\(\) AS uid\) = user_id\)', NULL\)/g) || [];
    assert.equal(serviceRows.length, 21);
    assert.equal(ownerRows.length, 4);
    assert.equal(serviceRows.length + ownerRows.length, 25);
  });

  it("never stages a regression to auth.role() policies after role-target hardening", () => {
    assert.match(hardening, /alter policy %I on %I\.%I to service_role using \(true\)/i);
    assert.match(hardening, /using \(\(select auth\.uid\(\)\) = user_id\)/i);
    assert.doesNotMatch(probe, /ALTER POLICY ["']?service role/i);
    assert.doesNotMatch(probe, /USING\s*\(\(\(select auth\.role\(\)\)/i);
  });

  it("preserves guarded exact state checks and rollback-only staging", () => {
    assert.match(probe, /LEFT JOIN pg_policies p/);
    assert.match(probe, /p\.qual IS DISTINCT FROM e\.qualifier/);
    assert.match(probe, /p\.roles::text IS DISTINCT FROM e\.roles/);
    assert.doesNotMatch(probe, /\b(?:CREATE|ALTER|DROP)\s+POLICY\b/i);
    assert.match(probe, /P1 subscription role or predicate drift; abort/);
    assert.match(probe, /p1_rls_hygiene_staging_passed/);
    assert.match(probe, /\bROLLBACK;\s*$/i);
  });
});
