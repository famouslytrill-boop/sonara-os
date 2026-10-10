"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const route = fs.readFileSync(path.join(ROOT, "routes", "sonara-route-registry-routes.cjs"), "utf8");
const service = fs.readFileSync(path.join(ROOT, "lib", "sonara-integration-readiness.cjs"), "utf8");
const worker = fs.readFileSync(path.join(ROOT, "scripts", "run-integration-readiness-worker.mjs"), "utf8");
const workflow = fs.readFileSync(path.join(ROOT, ".github", "workflows", "integration-readiness-worker.yml"), "utf8");
const openapi = fs.readFileSync(path.join(ROOT, "openapi", "sonara.yaml"), "utf8");
const envExample = fs.readFileSync(path.join(ROOT, ".env.example"), "utf8");

describe("integration readiness route and release contract", () => {
  it("keeps enqueue behind authentication, rate limit and exact canary scope", () => {
    assert.match(route, /app\.post\("\/api\/integrations\/readiness-probes", requireCustomer, integrationProbeLimiter/);
    assert.match(route, /readiness_worker_disabled/);
    assert.match(route, /organization\.organizationId !== activation\.organizationId/);
    assert.match(route, /readiness_canary_scope_mismatch/);
  });

  it("renders a readiness button only from the scoped-canary branch", () => {
    const start = route.indexOf('app.get("/account/integrations"');
    const end = route.indexOf('app.post("/api/integrations/readiness-probes"', start);
    assert.ok(start >= 0 && end > start);
    const page = route.slice(start, end);
    assert.match(page, /const scopedCanary = organization\.ok/);
    assert.match(page, /activation\.organizationId === organization\.organizationId/);
    assert.match(page, /action="\/api\/integrations\/readiness-probes"/);
    assert.match(page, /scopedCanary/);
    assert.match(page, /The readiness worker is off\. No provider job will be queued\./);
  });

  it("never selects credential references or provider settings into readiness views", () => {
    for (const pattern of [/select=[^"\n]*credential_reference/, /select=[^"\n]*auth_reference/, /select=[^"\n]*settings/]) {
      assert.doesNotMatch(service, pattern);
    }
    assert.match(service, /select=provider_key,connection_mode,connection_status,last_checked_at,updated_at/);
  });

  it("uses organization-scoped durable job types before claim and recovery", () => {
    assert.match(service, /function platformJobTypeForOrganization\(organizationId\)/);
    assert.match(service, /recoverStale\(\{ jobType: scopedJobType \}\)/);
    assert.match(service, /claim\(\{ workerId, jobType: scopedJobType \}\)/);
  });

  it("keeps the execution workflow manual, bounded and production-environment protected", () => {
    assert.match(workflow, /workflow_dispatch:/);
    assert.doesNotMatch(workflow, /^\s*(push|pull_request|schedule):/m);
    assert.match(workflow, /environment: production/);
    assert.match(workflow, /cancel-in-progress: false/);
    assert.match(workflow, /confirm_read_only_canary/);
    assert.match(workflow, /SONARA_INTEGRATION_READINESS_MAX_JOBS/);
  });

  it("the worker remains a read-only provider-state canary", () => {
    assert.match(worker, /externalProviderCalls: false/);
    assert.match(worker, /maxJobs/);
    assert.doesNotMatch(worker, /STRIPE_SECRET_KEY|RESEND_API_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY/);
  });

  it("documents the API and default-off environment values", () => {
    assert.match(openapi, /\/api\/integrations\/readiness-probes:/);
    assert.match(openapi, /does not contact, mutate, authorize, bill, publish to, or refresh credentials/);
    assert.match(envExample, /^SONARA_INTEGRATION_READINESS_WORKER_ENABLED=false$/m);
    assert.match(envExample, /^SONARA_INTEGRATION_READINESS_CANARY_ORG_ID=$/m);
    assert.match(envExample, /^SONARA_INTEGRATION_READINESS_MAX_JOBS=5$/m);
  });
});
