// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const sql = fs.readFileSync(path.join(__dirname,
  "../docs/architecture/SONARA_CONTROL_PLANE_SCHEMA_PROPOSAL_2026_10_07.sql"), "utf8");

describe("private governance database proposal guards",()=>{
  it("is explicitly review-only, not a runnable production migration",()=>{
    assert.match(sql,/DESIGN ONLY \/ NOT AN APPLIED MIGRATION/);
    assert.match(sql,/Do not run in production/);
  });
  it("separates company subscription ledger from customer self-reported money",()=>{
    assert.match(sql,/sonara_control\.sonara_own_journals/);
    assert.match(sql,/sonara_control\.external_customer_receipts/);
    assert.match(sql,/seller_reported_unverified/);
    assert.match(sql,/CHECK \(state = 'seller_reported_unverified'\)/);
  });
  it("stores explicit rule versions and human reviews",()=>{
    assert.match(sql,/sonara_control\.legal_rule_versions/);
    assert.match(sql,/source_checked_at/);
    assert.match(sql,/reviewed_by/);
    assert.match(sql,/rule_version_id/);
  });
  it("keeps abusive content outside public structured storage",()=>{
    assert.match(sql,/encrypted_blob_ref/);
    assert.match(sql,/digest_sha256/);
    assert.match(sql,/sonara_control\.review_cases/);
    assert.match(sql,/valid_notice_received_at/);
  });
  it("cannot mark a sha256 hash as a valid C2PA credential without review",()=>{
    assert.match(sql,/c2pa_validation.*NOT NULL DEFAULT 'not_checked'/s);
    assert.match(sql,/publication_state.*NOT NULL DEFAULT 'private_draft'/s);
  });
  it("retracts all user grants and enables RLS on all proposed tables",()=>{
    assert.match(sql,/REVOKE ALL ON SCHEMA sonara_control FROM anon, authenticated/);
    assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
    assert.match(sql,/REVOKE ALL ON sonara_control\.%I FROM anon, authenticated/);
    assert.doesNotMatch(sql,/CREATE POLICY .* USING \(true\)/);
  });
  it("outbox is limited to notifications, not customer payments",()=>{
    assert.match(sql,/sonara_control\.review_outbox/);
    assert.match(sql,/provenance_verification_requested/);
    assert.doesNotMatch(sql,/event_kind.*'charge_customer'/s);
  });
  it("includes resource quotas to avoid unlimited usage promises",()=>{
    assert.match(sql,/tenant_resource_budgets/);
    assert.match(sql,/max_storage_bytes/);
    assert.match(sql,/max_worker_seconds/);
  });
});
