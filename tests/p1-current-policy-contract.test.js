// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root=path.join(__dirname,"..");
const sql=fs.readFileSync(path.join(root,"tests/sql/p1-current-policy-contract.sql"),"utf8");
const replay=fs.readFileSync(path.join(root,"scripts/verify-migration-replay.mjs"),"utf8");
const historical=fs.readFileSync(path.join(root,"tests/sql/p1-rls-initplan-policy-dedup-rollback.sql"),"utf8");
const vals=sql.slice(sql.indexOf("VALUES\n"),sql.indexOf("\n  ),\n  status AS"));
const expected=[...vals.matchAll(/\('([^']+)',\s*'([^']+)',\s*'(service|own)'\)/g)];
describe("Current P1 policy replay contract",()=>{
  it("checks exactly 25 modern policy names and distinguishes service from user scope",()=>{
    assert.equal(expected.length,25);
    assert.equal(new Set(expected.map(m=>m[1]+"."+m[2])).size,25);
    assert.equal(expected.filter(m=>m[3]==="service").length,21);
    assert.equal(expected.filter(m=>m[3]==="own").length,4);
    assert.match(sql,/IF expected_count <> 25 THEN/);
  });
  it("requires hard role restriction, original user ownership and exact RLS commands",()=>{
    assert.match(sql,/p\.roles=ARRAY\['service_role'\]::name\[\]/);
    assert.match(sql,/p\.qual='true'/);
    assert.match(sql,/p\.with_check='true'/);
    assert.match(sql,/p\.roles=ARRAY\['authenticated'\]::name\[\]/);
    assert.match(sql,/p\.qual='\(\( SELECT auth\.uid\(\) AS uid\) = user_id\)'/);
    assert.match(sql,/p\.cmd='SELECT'/);
    assert.match(sql,/p\.cmd='ALL'/);
    assert.match(sql,/safe IS DISTINCT FROM true/);
  });
  it("preserves the subscription duplicate-policy baseline as a detectable contract",()=>{
    assert.match(sql,/Users can view own subscriptions/);
    assert.match(sql,/Users can view their own subscription/);
    assert.match(sql,/subscription policy baseline drift/);
    assert.match(sql,/\) <> 2 THEN/);
  });
  it("does not rewrite or disable policies merely to make a replay green",()=>{
    assert.doesNotMatch(sql,/\bALTER POLICY\b|\bDROP POLICY\b|\bCREATE POLICY\b|\bDISABLE ROW LEVEL SECURITY\b/i);
    assert.ok(replay.includes("tests/sql/p1-current-policy-contract.sql"));
    assert.ok(replay.includes("p1_current_policy_contract_passed"));
    assert.ok(!replay.includes('fs.readFileSync(path.join(root, "tests/sql/p1-rls-initplan-policy-dedup-rollback.sql"'));
    assert.ok(historical.includes("ROLLBACK;"));
  });
});
