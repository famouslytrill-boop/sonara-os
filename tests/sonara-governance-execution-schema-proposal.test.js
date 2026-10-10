// Copyright (c) 2026 SONARA Industries. All rights reserved.
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const sql=fs.readFileSync(path.join(__dirname,
  "../docs/architecture/SONARA_GOVERNANCE_EXECUTION_CLAIM_SCHEMA_PROPOSAL_2026_10_08.sql"),"utf8");
describe("governed execution SQL proposal",()=>{
  it("is explicitly review-only rather than a production migration",()=>{
    assert.match(sql,/DESIGN ONLY \/ NOT AN APPLIED MIGRATION/);
    assert.match(sql,/MUST NOT be added to the migration glob/);
  });
  it("binds claims to exact immutable snapshots and tenant-scoped idempotency",()=>{
    assert.match(sql,/proposal_snapshot_sha256 char\(64\)/);
    assert.match(sql,/UNIQUE \(organization_id,idempotency_key\)/);
    assert.match(sql,/claim_expires_at > claimed_at/);
  });
  it("binds the claim to the canonical organization approval queue",()=>{
    assert.match(sql,/pending_action_id uuid NOT NULL/);
    assert.match(sql,/public\.agent_pending_actions/);
    assert.match(sql,/must not become a second organization approval truth/);
  });
  it("records attempts separately from the claim",()=>{
    assert.match(sql,/sonara_governed_execution\.attempts/);
    assert.match(sql,/attempt_no integer/);
    assert.match(sql,/UNIQUE \(organization_id,claim_id,attempt_no\)/);
  });
  it("requires verified observed evidence for successful provider settlement",()=>{
    assert.match(sql,/outcome <> 'verified_success' OR/);
    assert.match(sql,/provider_result_verified = true/);
    assert.match(sql,/side_effect_observed = true/);
  });
  it("models shared budget and concurrency consumption in the claim boundary",()=>{
    assert.match(sql,/resource_consumptions/);
    assert.match(sql,/'concurrency'/);
    assert.match(sql,/consumed_units integer NOT NULL/);
  });
  it("reuses the existing durable event outbox instead of creating a second one",()=>{
    assert.match(sql,/REUSES public\.event_outbox and public\.event_delivery_attempts/);
    assert.doesNotMatch(sql,/CREATE TABLE IF NOT EXISTS sonara_governed_execution\.outbox/);
    assert.match(sql,/existing organization-scoped idempotency\/event contract/);
  });
  it("keeps browser roles revoked and RLS enabled",()=>{
    assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
    assert.match(sql,/REVOKE ALL ON sonara_governed_execution\.%I FROM anon, authenticated/);
  });
  it("does not define credential or customer-payment secret columns",()=>{
    assert.doesNotMatch(sql,/stripe_secret_key|cvv|card_number|bank_account_number|service_role_key/i);
  });
  it("requires provider timeout to remain unknown until reconciliation",()=>{
    assert.match(sql,/provider timeout is UNKNOWN until provider reconciliation proves outcome/);
  });
  it("requires a simultaneous-claim concurrency proof before release",()=>{
    assert.match(sql,/50 simultaneous claims -> exactly one winner/);
  });
});
