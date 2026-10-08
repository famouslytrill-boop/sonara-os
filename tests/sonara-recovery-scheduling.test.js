"use strict";
const assert = require("node:assert/strict");
const { enqueueBoundedRetry } = require("../lib/sonara-recovery-scheduling.cjs");
const { executeRemediation } = require("../lib/sonara-self-healing-supervisor.cjs");
const NOW = 1800000000000;
const INCIDENT = Object.freeze({
  incidentId:"i-1",resourceId:"optional-email",scope:"organization",organizationId:"org-1",
  observedAtMs:NOW-1000,sensitive:false,authorizedScope:true,domain:"optional_provider",
  signal:"provider.rate_limited",verifiedIdempotency:true,operationId:"op-1",attempt:0,
  retryAfterMs:5000,deadlineAtMs:NOW+30000
});
const schedule = (overrides = {}, config = {}) => enqueueBoundedRetry({...INCIDENT,...overrides},{nowMs:NOW,...config});
describe("bounded delayed retry scheduling", () => {
  it("refuses to start an immediate provider retry even with a valid audit adapter", async () => {
    let effects = 0;
    const r = await executeRemediation(INCIDENT,{enabled:true,nowMs:NOW,
      ledger:{claim:async()=>({claimed:true})},audit:async()=>true,
      handlers:{retry_idempotent:async()=>{effects++;}},verify:async()=>({healthy:true,scopeVerified:true})});
    assert.equal(r.reason,"durable_due_claim_required");
    assert.equal(effects,0);
  });
  it("persists a not-before time respecting provider Retry-After", async () => {
    let seen;
    const r = await schedule({}, {enabled:true,scheduler:{schedule:async job=>{
      seen=job;return {persisted:true,notBeforeMs:job.notBeforeMs};
    }}});
    assert.equal(r.status,"scheduled");
    assert.ok(seen.notBeforeMs>=NOW+5000);
    assert.ok(seen.notBeforeMs+1000<seen.deadlineAtMs);
    assert.equal(seen.action,"retry_idempotent");
    assert.equal(seen.organizationId,"org-1");
    assert.ok(!JSON.stringify(seen).includes("sk_live"));
  });
  it("fails closed on absent, failing, or dishonest scheduler", async () => {
    assert.equal((await schedule({}, {enabled:true})).reason,"durable_retry_scheduler_missing");
    assert.equal((await schedule({}, {enabled:true,scheduler:{schedule:async()=>{throw Error("secret");}}})).reason,"scheduler_unavailable");
    assert.equal((await schedule({}, {enabled:true,scheduler:{schedule:async()=>({persisted:true,notBeforeMs:0})}})).reason,"schedule_not_confirmed");
    assert.equal((await schedule({}, {enabled:false})).status,"disabled");
  });
  it("deduplicates and avoids scheduling unauthorized changes", async () => {
    let calls=0;
    const scheduler={schedule:async()=>{calls++;return {duplicate:true};}};
    assert.equal((await schedule({}, {enabled:true,scheduler})).status,"suppressed");
    assert.equal((await schedule({authorizedScope:false}, {enabled:true,scheduler})).status,"escalated");
    assert.equal((await schedule({attempt:3}, {enabled:true,scheduler})).status,"escalated");
    assert.equal((await schedule({domain:"payments"}, {enabled:true,scheduler})).status,"escalated");
    assert.equal(calls,1);
  });
});
