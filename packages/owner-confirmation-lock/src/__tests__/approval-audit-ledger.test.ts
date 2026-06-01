import { describe, expect, it } from "vitest";
import {
  createApprovalAuditEvent,
  createApprovalAuditLedger,
  createSensitiveActionRecord
} from "../index.ts";

describe("approval audit ledger", () => {
  it("creates audit logs for approval events", () => {
    const record = createSensitiveActionRecord({
      actionKey: "change_price",
      category: "price_changes",
      productArea: "Pricing",
      title: "Change price",
      description: "Change Core plan price",
      triggeredBy: "admin"
    });
    const event = createApprovalAuditEvent(
      record,
      "owner_review.approved",
      "owner_1",
      "Owner approved pricing change.",
      "2026-05-20T00:00:00.000Z"
    );
    const ledger = createApprovalAuditLedger();
    ledger.append(event);
    expect(ledger.getEvents()).toEqual([event]);
    expect(event.action_category).toBe("price_changes");
  });
});
