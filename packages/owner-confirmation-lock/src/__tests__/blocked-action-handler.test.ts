import { describe, expect, it } from "vitest";
import {
  blockSensitiveAction,
  canBlockedActionExecute,
  createSensitiveActionRecord
} from "../index.ts";

describe("blocked action handler", () => {
  it("prevents blocked actions from executing", () => {
    const record = createSensitiveActionRecord({
      actionKey: "delete_audit_logs",
      category: "deleting_data",
      productArea: "Security Center",
      title: "Delete audit logs",
      description: "Delete approval logs",
      triggeredBy: "automation"
    });
    const blocked = blockSensitiveAction(record, "audit_log_deletion_blocked");
    expect(blocked.record.approval_status).toBe("blocked");
    expect(canBlockedActionExecute(blocked.record)).toBe(false);
    expect(blocked.auditEvent.event_type).toBe("owner_review.blocked");
  });
});
