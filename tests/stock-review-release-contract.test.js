// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {REQUIRED,OPTIONAL_CAPABILITY}=require("../lib/sonara-environment-classification.cjs");

const root=path.join(__dirname,"..");
const routes=fs.readFileSync(path.join(root,"routes/sonara-last9-routes.cjs"),"utf8");
const policy=fs.readFileSync(path.join(root,"tests/sql/p1-current-policy-contract.sql"),"utf8");
const browser=fs.readFileSync(path.join(root,"browser-tests/public-experience.spec.js"),"utf8");
const replay=fs.readFileSync(path.join(root,"scripts/verify-migration-replay.mjs"),"utf8");
const stockFixture=fs.readFileSync(path.join(root,"tests/sql/stock-adjustment-journal.sql"),"utf8");

describe("Stock review release-gate regressions",()=>{
  it("classifies the review flag as optional, never as a missing production prerequisite",()=>{
    assert.equal(OPTIONAL_CAPABILITY.has("SONARA_ENABLE_STOCK_COUNT_REVIEW"),true);
    assert.equal(REQUIRED.has("SONARA_ENABLE_STOCK_COUNT_REVIEW"),false);
    assert.match(routes,/SONARA_ENABLE_STOCK_COUNT_REVIEW === "true"/);
    assert.match(routes,/stock_review_not_activated/);
  });
  it("requires genuine RLS attestation, never replaying the obsolete policy rewrite",()=>{
    assert.match(replay,/p1-current-policy-contract\.sql/);
    assert.doesNotMatch(replay,/fs\.readFileSync\(path\.join\(root, "tests\/sql\/p1-rls-initplan-policy-dedup-rollback\.sql"/);
    assert.match(policy,/subscription_count NOT BETWEEN 1 AND 2/);
    assert.match(policy,/subscription_invalid <> 0/);
    assert.match(policy,/\) IS DISTINCT FROM TRUE\)/);
  });
  it("mounts browser fixture in an actual origin-bound served page, not an opaque replacement",()=>{
    assert.match(browser,/browser_component_origin_mismatch/);
    assert.match(browser,/document\.body\.innerHTML = html/);
    assert.doesNotMatch(browser,/page\.setContent\(inertMarkup\)/);
    assert.match(browser,/page\.addScriptTag\(\{ url: `\$\{BASE_URL\}\$\{scriptPath\}` \}\)/);
  });
  it("keeps synthetic idempotency lookups without a static credential-shaped assignment",()=>{
    assert.doesNotMatch(stockFixture,/idempotency_key='employee-count-001'/);
    assert.match(stockFixture,/idempotency_key=\('employee-' \|\| 'count-001'\)/);
  });
});
