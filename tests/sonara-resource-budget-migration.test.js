// Copyright (c) 2026 SONARA Industries. All rights reserved.
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const sql=fs.readFileSync(
  path.join(__dirname,"../supabase/migrations/20261008222500_customer_weighted_resource_budgets.sql"),
  "utf8"
);

describe("weighted resource budget migration contract",()=>{
  it("keeps budget tables outside the public Data API surface",()=>{
    assert.match(sql,/create schema if not exists sonara_governance/i);
    assert.match(sql,/revoke all on schema sonara_governance from public, anon, authenticated/i);
    assert.match(sql,/revoke all on sonara_governance\.resource_budget_state from public, anon, authenticated, service_role/i);
    assert.match(sql,/revoke all on sonara_governance\.resource_budget_leases from public, anon, authenticated, service_role/i);
  });

  it("uses security-definer RPCs with an empty search path and service-role-only execution",()=>{
    for(const name of [
      "sonara_consume_resource_budget",
      "sonara_claim_resource_concurrency",
      "sonara_release_resource_concurrency"
    ]){
      assert.match(sql,new RegExp("function public\\."+name+"\\(","i"));
    }
    assert.ok((sql.match(/security definer/gi)||[]).length>=3);
    assert.ok((sql.match(/set search_path = ''/gi)||[]).length>=3);
    assert.ok((sql.match(/grant execute on function public\.sonara_/gi)||[]).length>=3);
    assert.doesNotMatch(sql,/grant execute[^;]*to\s+(?:public|anon|authenticated)/i);
  });

  it("stores only SHA-256 bucket keys rather than raw customer-identifier columns",()=>{
    assert.match(sql,/bucket_key char\(64\)/i);
    assert.match(sql,/bucket_key ~ '\^\[a-f0-9\]\{64\}\$'/i);
    const withoutLineComments=sql.replace(/--.*$/gm,"");
    assert.doesNotMatch(
      withoutLineComments,
      /\b(email|ip_address|raw_ip|access_token|refresh_token|api_key)\s+(?:text|inet|varchar|character|jsonb?)\b/i
    );
  });

  it("serializes budget consumption before changing shared state",()=>{
    assert.match(sql,/from sonara_governance\.resource_budget_state[\s\S]*?for update/i);
    assert.match(sql,/weighted_rate_budget_exceeded/i);
    assert.match(sql,/daily_budget_exceeded/i);
    assert.match(sql,/budget_exhausted_no_refill/i);
  });

  it("uses expiring idempotent concurrency leases instead of a fragile active counter",()=>{
    assert.match(sql,/resource_budget_leases/i);
    assert.match(sql,/expires_at <= v_now/i);
    assert.match(sql,/lease_reused/i);
    assert.match(sql,/concurrency_budget_exceeded/i);
    assert.match(sql,/on delete cascade/i);
  });

  it("self-tests consume, saturation, replay, release and capacity recovery",()=>{
    assert.match(sql,/resource budget self-test: first consume should pass/i);
    assert.match(sql,/second consume should hit rate budget/i);
    assert.match(sql,/replay must reuse the lease/i);
    assert.match(sql,/second lease should be denied/i);
    assert.match(sql,/capacity should recover after release/i);
  });
});
