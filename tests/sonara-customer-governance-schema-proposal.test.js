// Copyright (c) 2026 SONARA Industries. All rights reserved.
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const sql=fs.readFileSync(path.join(__dirname,
  "../docs/architecture/SONARA_CUSTOMER_GOVERNANCE_AUTOMATION_SCHEMA_PROPOSAL_2026_10_07.sql"),"utf8");
describe("customer governance/automation SQL proposal",()=>{
  it("is explicitly design-only and outside the migration contract",()=>{
    assert.match(sql,/DESIGN ONLY \/ NOT AN APPLIED MIGRATION/);
    assert.match(sql,/Do not execute in production/);
  });
  it("stores exact approval snapshot hashes and bounded approval windows",()=>{
    assert.match(sql,/proposal_snapshot_sha256 char\(64\)/);
    assert.match(sql,/expires_at timestamptz NOT NULL/);
    assert.match(sql,/approval_decisions/);
  });
  it("separates customer review author confirmation from moderation",()=>{
    assert.match(sql,/customer_reviews/);
    assert.match(sql,/review_author_confirmations/);
    assert.match(sql,/review_moderation_events/);
    assert.match(sql,/approved_sha256/);
  });
  it("records review incentive and AI-assistance disclosures rather than fabricating reviews",()=>{
    assert.match(sql,/incentive_sentiment_conditioned/);
    assert.match(sql,/fully_ai_generated/);
    assert.match(sql,/relationship_disclosed/);
  });
  it("stores proof coverage and source evidence without claiming truth certification",()=>{
    assert.match(sql,/proof_packets/);
    assert.match(sql,/required_coverage_basis_points/);
    assert.match(sql,/independently_retrieved/);
  });
  it("stores inherent and residual risk separately and requires evidence for controls",()=>{
    assert.match(sql,/inherent_score/);
    assert.match(sql,/residual_score/);
    assert.match(sql,/control_evidence_verified/);
  });
  it("provides durable rate-budget state for atomic future server procedures",()=>{
    assert.match(sql,/rate_budget_state/);
    assert.match(sql,/available_units/);
    assert.match(sql,/refill_units_per_minute/);
    assert.match(sql,/active_concurrency/);
  });
  it("records trusted time/deadline anchors separately from client-reported time",()=>{
    assert.match(sql,/client_reported_at/);
    assert.match(sql,/server_received_at/);
    assert.match(sql,/verified_provider_occurred_at/);
    assert.match(sql,/deadline_records/);
  });
  it("prevents blanket-enabled approval-per-run automation definitions",()=>{
    assert.match(sql,/execution_mode <> 'approval_per_run' OR enabled = false/);
  });
  it("enables RLS and revokes generic browser access for every proposed table",()=>{
    assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
    assert.match(sql,/REVOKE ALL ON sonara_governance\.%I FROM anon, authenticated/);
    assert.doesNotMatch(sql,/CREATE POLICY .* USING \(true\)/);
  });
});
