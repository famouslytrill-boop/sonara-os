// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const sql=fs.readFileSync(path.join(__dirname,
  "../docs/architecture/SONARA_FILE_SPREADSHEET_OFFLINE_SCHEMA_PROPOSAL_2026_10_07.sql"),"utf8");
describe("secure file/spreadsheet/offline SQL proposal",()=>{
  it("is explicitly design-only",()=>{
    assert.match(sql,/DESIGN ONLY \/ NOT AN APPLIED MIGRATION/);
    assert.match(sql,/Do not execute against production/);
  });
  it("stores file metadata separately from object bytes and uses hash/quarantine state",()=>{
    assert.match(sql,/sonara_files\.file_objects/);
    assert.match(sql,/sha256 char\(64\)/);
    assert.match(sql,/quarantine_state/);
    assert.match(sql,/bucket_key/);
    assert.match(sql,/object_key/);
  });
  it("tracks local device key aliases, never raw encryption keys",()=>{
    assert.match(sql,/device_key_alias/);
    assert.match(sql,/android_keystore/);
    assert.match(sql,/apple_keychain/);
    assert.doesNotMatch(sql,/raw_encryption_key/);
  });
  it("offline mutation enum contains no payments, payouts, legal execution or deletes",()=>{
    const start=sql.indexOf("CREATE TABLE IF NOT EXISTS sonara_files.offline_mutations");
    const end=sql.indexOf("CREATE TABLE IF NOT EXISTS sonara_files.workbooks",start);
    const block=sql.slice(start,end);
    assert.doesNotMatch(block,/refund|payout|payment_confirmation|lease_signature|tenant_rejection/);
    assert.match(block,/append_note/);
  });
  it("spreadsheet storage holds typed/calculated values rather than raw executable formulas",()=>{
    assert.match(sql,/typed_values jsonb/);
    assert.match(sql,/calculated_values jsonb/);
    assert.match(sql,/deterministic_formula_schema/);
    assert.doesNotMatch(sql,/excel_formula text/);
  });
  it("records spreadsheet formula-injection guard and altered cell count",()=>{
    assert.match(sql,/formula_guard/);
    assert.match(sql,/quoted_tab_prefix/);
    assert.match(sql,/neutralized_cells/);
  });
  it("tracks legal holds separately from deletion candidates",()=>{
    assert.match(sql,/legal_hold boolean/);
    assert.match(sql,/purge_blocked_legal_hold/);
  });
  it("enables RLS and revokes generic browser roles",()=>{
    assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
    assert.match(sql,/REVOKE ALL ON sonara_files\.%I FROM anon, authenticated/);
    assert.doesNotMatch(sql,/CREATE POLICY .* USING \(true\)/);
  });
});
