import { describe, expect, it } from "vitest";
import { createOwnerReviewQueueItemFromRecord, createSensitiveActionRecord } from "../index.ts";

describe("owner review queue", () => {
  it("creates redacted queue items for owner review", () => {
    const record = createSensitiveActionRecord(
      {
        actionKey: "approve_generated_visual",
        category: "ai_visual_output",
        productArea: "Creator Studio",
        title: "Approve campaign visual",
        description: "Publish visual with secret: abc123",
        triggeredBy: "asset-reviewer",
        affectedRecords: ["asset_1"]
      },
      "queued_for_owner_review"
    );
    const item = createOwnerReviewQueueItemFromRecord(record);
    expect(item.action_id).toBe(record.id);
    expect(item.action_preview).toContain("secret=[redacted]");
    expect(item.affected_records).toEqual(["asset_1"]);
  });
});
