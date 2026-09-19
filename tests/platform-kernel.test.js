"use strict";

const assert = require("assert");
const {
  PLATFORM_KERNEL_VERSION,
  createExecutionEnvelope,
  initialExecutionState,
  assertTransition,
  buildPlatformEvent,
  contractSnapshot
} = require("../lib/sonara-platform-kernel.cjs");

describe("SONARA platform kernel", () => {
  const base = {
    organizationId: "org-1",
    actorUserId: "user-1",
    workflowKey: "operations.customer_followup",
    idempotencyKey: "idem-1",
    correlationId: "corr-1"
  };

  it("creates a ready envelope for an allowlisted reversible action", () => {
    const envelope = createExecutionEnvelope({ ...base, actionType: "draft_reply" });
    assert.equal(envelope.requiresOwnerApproval, false);
    assert.equal(envelope.approvalState, "not_required");
    assert.equal(initialExecutionState(envelope), "ready");
  });

  it("fails closed into approval for an unrecognised action", () => {
    const envelope = createExecutionEnvelope({ ...base, actionType: "send_invoice" });
    assert.equal(envelope.requiresOwnerApproval, true);
    assert.equal(envelope.approvalState, "pending");
    assert.equal(initialExecutionState(envelope), "awaiting_approval");
  });

  it("does not allow sensitive actions to claim approval is unnecessary", () => {
    assert.throws(
      () => createExecutionEnvelope({ ...base, actionType: "customer_campaign", approvalState: "not_required" }),
      /cannot bypass approval/
    );
  });

  it("requires tenant, actor, workflow and idempotency identity", () => {
    assert.throws(() => createExecutionEnvelope({ ...base, organizationId: "", actionType: "draft_reply" }), /organizationId/);
    assert.throws(() => createExecutionEnvelope({ ...base, actorUserId: "", actionType: "draft_reply" }), /actorUserId/);
    assert.throws(() => createExecutionEnvelope({ ...base, workflowKey: "", actionType: "draft_reply" }), /workflowKey/);
    assert.throws(() => createExecutionEnvelope({ ...base, idempotencyKey: "", actionType: "draft_reply" }), /idempotencyKey/);
  });

  it("permits only explicit lifecycle transitions", () => {
    assert.equal(assertTransition("planned", "ready"), true);
    assert.equal(assertTransition("ready", "running"), true);
    assert.equal(assertTransition("running", "succeeded"), true);
    assert.throws(() => assertTransition("planned", "succeeded"), /invalid execution transition/);
    assert.throws(() => assertTransition("succeeded", "running"), /invalid execution transition/);
  });

  it("builds tenant-scoped event records from the same execution identity", () => {
    const envelope = createExecutionEnvelope({
      ...base,
      actionType: "draft_reply",
      resourceType: "customer_record",
      resourceId: "customer-7"
    });
    const event = buildPlatformEvent(envelope, "workflow.ready", { metadata: { source: "operations" } });
    assert.equal(event.organization_id, "org-1");
    assert.equal(event.actor_user_id, "user-1");
    assert.equal(event.correlation_id, "corr-1");
    assert.equal(event.idempotency_key, "idem-1");
    assert.equal(event.resource_id, "customer-7");
    assert.equal(event.metadata.kernelVersion, PLATFORM_KERNEL_VERSION);
    assert.equal(event.metadata.source, "operations");
  });

  it("publishes a stable contract snapshot", () => {
    const snapshot = contractSnapshot();
    assert.equal(snapshot.version, PLATFORM_KERNEL_VERSION);
    assert(snapshot.domains.operations.includes("projects"));
    assert(snapshot.domains.assets.includes("assets"));
    assert(snapshot.domains.commercial.includes("usage"));
    assert(snapshot.states.includes("awaiting_approval"));
  });
});
