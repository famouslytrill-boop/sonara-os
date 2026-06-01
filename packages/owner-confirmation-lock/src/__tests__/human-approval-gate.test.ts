import { describe, expect, it } from "vitest";
import { createHumanApprovalGate } from "../index.ts";

describe("human approval gate", () => {
  it("queues sensitive actions and executes only after approval", () => {
    const gate = createHumanApprovalGate();
    const queued = gate.submitAction({
      actionKey: "send_campaign",
      category: "customer_facing_campaigns",
      productArea: "Growth Studio",
      title: "Send campaign",
      description: "Send customer-facing email",
      triggeredBy: "automation",
      createdBy: "system"
    });
    expect(queued.queued).toBe(true);
    expect(gate.executeOnlyAfterApproval(queued.record.id).executed).toBe(false);
    const approval = gate.approveAction(queued.record.id, "owner_1");
    expect(approval.approved).toBe(true);
    expect(gate.executeOnlyAfterApproval(queued.record.id)).toMatchObject({
      executed: true,
      reason: "Executed after owner approval."
    });
  });

  it("does not execute rejected actions", () => {
    const gate = createHumanApprovalGate();
    const queued = gate.submitAction({
      actionKey: "publish_proof",
      category: "publishing_proof_reviews",
      productArea: "Business Builder",
      title: "Publish proof",
      description: "Publish proof passport",
      triggeredBy: "automation"
    });
    gate.rejectAction(queued.record.id, "owner_1", "Not ready.");
    expect(gate.executeOnlyAfterApproval(queued.record.id).executed).toBe(false);
  });
});
