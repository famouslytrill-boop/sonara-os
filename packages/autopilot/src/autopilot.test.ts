import { describe, expect, it } from "vitest";
import {
  approveWorkflowRecord,
  autoSafeActionKinds,
  blockedActionKinds,
  createActionQueue,
  createAutopilotWorkflowEngine,
  createWorkflowRecord,
  evaluateAutomationAction,
  ownerReviewActionKinds
} from "./index.ts";

describe("Business Autopilot Board policy", () => {
  it("classifies safe, review-required, and blocked actions", () => {
    expect(autoSafeActionKinds).toContain("create_internal_task");
    expect(ownerReviewActionKinds).toContain("send_customer_message");
    expect(blockedActionKinds).toContain("delete_customer_data");
    expect(evaluateAutomationAction("draft_message").approvalLevel).toBe("auto_safe");
    expect(evaluateAutomationAction("send_review_request").approvalLevel).toBe("owner_review");
    expect(evaluateAutomationAction("disable_security_feature").approvalLevel).toBe("blocked");
  });

  it("creates workflow records with approval and risk metadata", () => {
    const record = createWorkflowRecord({
      workflowType: "request_review",
      actionKind: "send_review_request",
      title: "Send review request",
      description: "Owner must approve before customer contact.",
      confidence: 0.85
    });

    expect(record.status).toBe("pending_approval");
    expect(record.approval_level).toBe("owner_review");
    expect(record.risk).toBe("medium");
    expect(record.confidence).toBe(0.85);
  });

  it("queues safe actions and blocks unsafe actions", () => {
    const queue = createActionQueue();
    const safe = queue.queueAction({
      workflowType: "create_task",
      actionKind: "create_internal_task",
      title: "Create internal setup task",
      description: "Create a private task for the owner."
    });
    const blocked = queue.queueAction({
      workflowType: "sync_external_connection",
      actionKind: "change_payout_destination",
      title: "Change payout destination",
      description: "Blocked payment destination change."
    });

    expect(safe.canRun).toBe(true);
    expect(blocked.canRun).toBe(false);
    expect(queue.getState().queued).toHaveLength(1);
    expect(queue.getState().blocked).toHaveLength(1);
    expect(queue.getState().auditEvents.map((event) => event.event_type)).toContain(
      "action.blocked"
    );
  });

  it("prevents approval of blocked actions", () => {
    const record = createWorkflowRecord({
      workflowType: "sync_external_connection",
      actionKind: "delete_customer_data",
      title: "Delete customer",
      description: "Blocked deletion attempt."
    });

    const decision = approveWorkflowRecord(record, "owner_1");
    expect(decision.approved).toBe(false);
    expect(decision.record.status).toBe("blocked");
  });

  it("seeds board state with queued, approval, blocked, and audit records", () => {
    const engine = createAutopilotWorkflowEngine();
    const state = engine.seedDefaults();

    expect(state.completed.length).toBeGreaterThan(0);
    expect(state.approvalRequired.length).toBeGreaterThan(0);
    expect(state.blocked.length).toBeGreaterThan(0);
    expect(state.auditEvents.length).toBeGreaterThan(0);
  });
});
