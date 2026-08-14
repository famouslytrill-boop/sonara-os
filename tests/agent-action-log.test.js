"use strict";

const assert = require("node:assert/strict");
const { toRow, riskLevelFor, approvalStateFor, createActionLogRecorder } = require("../lib/sonara-agent-action-log.cjs");
const { createRunner } = require("../lib/sonara-agent-runner.cjs");

const ORG = "11111111-1111-1111-1111-111111111111";

function runFor(overrides = {}) {
  return {
    actionType: "summarise_records",
    classification: { requiresOwnerApproval: false, category: "self_serve", reason: "It reads and reports." },
    status: "completed",
    reason: "It reads and reports.",
    startedAt: "2026-08-11T00:00:00.000Z",
    finishedAt: "2026-08-11T00:00:01.000Z",
    result: { rows: 4 },
    ...overrides
  };
}

describe("agent action log rows", () => {
  it("refuses to build a row without an organization", () => {
    assert.throws(() => toRow({ run: runFor(), organizationId: null }), /organizationId/);
  });

  it("never carries the handler's return value into the log", () => {
    const row = toRow({ run: runFor({ result: { customerEmail: "someone@example.com" } }), organizationId: ORG });
    assert.equal(JSON.stringify(row).includes("someone@example.com"), false);
    assert.equal("result" in row.metadata, false);
  });

  it("redacts a failed run's reason rather than trusting the handler", () => {
    const run = runFor({
      status: "failed",
      classification: { requiresOwnerApproval: false, category: "self_serve", reason: "x" },
      reason: "request to https://db.supabase.co/rest/v1/x?apikey=eyJhbGciOi.JzdWIiOiJ.abcdefgh failed"
    });
    const row = toRow({ run, organizationId: ORG });
    assert.equal(row.metadata.reason.includes("eyJhbGciOi.JzdWIiOiJ.abcdefgh"), false);
  });

  it("ranks a named sensitive category above an unrecognised one", () => {
    assert.equal(riskLevelFor({ requiresOwnerApproval: true, category: "refunds" }), "high");
    assert.equal(riskLevelFor({ requiresOwnerApproval: true, category: "unrecognised" }), "medium");
    assert.equal(riskLevelFor({ requiresOwnerApproval: false, category: "self_serve" }), "low");
  });

  it("derives approval state from the classification, not from the run's own claim", () => {
    const gated = { requiresOwnerApproval: true, category: "refunds" };
    assert.equal(approvalStateFor({ classification: gated, status: "refused" }), "pending");
    assert.equal(approvalStateFor({ classification: gated, status: "completed" }), "approved");
    assert.equal(approvalStateFor({ classification: { requiresOwnerApproval: false }, status: "completed" }), "not_required");
  });

  it("scopes the insert to the organization in the body", async () => {
    let sent = null;
    const originalFetch = global.fetch;
    global.fetch = async (url, options) => {
      sent = { url: String(url), body: JSON.parse(options.body) };
      return { ok: true, status: 201 };
    };
    try {
      const record = createActionLogRecorder({
        organizationId: ORG,
        agentKey: "operations",
        getSupabaseServerConfig: () => ({ ok: true, url: "https://db.example.co", serviceRoleKey: "service-role" })
      });
      const outcome = await record(runFor());
      assert.equal(outcome.ok, true);
    } finally {
      global.fetch = originalFetch;
    }
    assert.equal(sent.url, "https://db.example.co/rest/v1/agent_action_logs");
    assert.equal(sent.body.organization_id, ORG);
    assert.equal(sent.body.agent_key, "operations");
  });

  it("records a refused run, because a refusal is the thing worth having a record of", async () => {
    const written = [];
    const runner = createRunner({ record: async (run) => written.push(toRow({ run, organizationId: ORG })) });
    const outcome = await runner.run({ action: { action_type: "issue_refund" } });

    assert.equal(outcome.status, "refused");
    assert.equal(written.length, 1);
    assert.equal(written[0].result, "refused");
    assert.equal(written[0].approval_state, "pending");
    assert.equal(written[0].risk_level, "high");
    assert.equal(written[0].metadata.category, "refunds");
  });

  it("reports a failed insert rather than relying on the runner swallowing it", async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => ({ ok: false, status: 500 });
    try {
      const record = createActionLogRecorder({
        organizationId: ORG,
        getSupabaseServerConfig: () => ({ ok: true, url: "https://db.example.co", serviceRoleKey: "service-role" })
      });
      assert.deepEqual(await record(runFor()), { ok: false, status: 500 });
    } finally {
      global.fetch = originalFetch;
    }
  });
});
