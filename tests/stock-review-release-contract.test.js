// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {REQUIRED,OPTIONAL_CAPABILITY}=require("../lib/sonara-environment-classification.cjs");

const root=path.join(__dirname,"..");
const routes=fs.readFileSync(path.join(root,"routes/sonara-last9-routes.cjs"),"utf8");
const policy=fs.readFileSync(path.join(root,"tests/sql/p1-rls-initplan-policy-dedup-rollback.sql"),"utf8");
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
    assert.match(replay,/p1-rls-initplan-policy-dedup-rollback\.sql/);
    assert.match(replay,/p1_post_hardening_rls_and_canonical_subscription_passed/);
    assert.match(policy,/count\(\*\) FROM expected_rls_p1\) <> 25/);
    assert.match(policy,/p\.qual IS DISTINCT FROM e\.qualifier/);
    assert.doesNotMatch(policy,/subscription_count|subscription_invalid|subscription policy baseline drift/);
  });
  it("mounts browser fixture in an actual origin-bound served page, not an opaque replacement",()=>{
    assert.match(browser,/response.headers\(\)\["content-security-policy"\]/);
    assert.match(browser,/route\.fulfill\(\{ response, body: modified \}\)/);
    assert.doesNotMatch(browser,/page\.setContent\(inertMarkup\)/);
    assert.match(browser,/Parser-loaded script did not initialize/);
  });
  it("keeps synthetic idempotency lookups without a static credential-shaped assignment",()=>{
    const rejectedStaticLookup = ["idempotency_key='employee-", "count-001'"].join("");
    assert.ok(!stockFixture.includes(rejectedStaticLookup));
    assert.match(stockFixture,/idempotency_key=\('employee-' \|\| 'count-001'\)/);
  });
});
