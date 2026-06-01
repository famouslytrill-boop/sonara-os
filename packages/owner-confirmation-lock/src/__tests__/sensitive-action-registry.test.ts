import { describe, expect, it } from "vitest";
import {
  alwaysBlockedActionKeys,
  getSensitiveActionRegistryEntry,
  isAlwaysBlockedActionKey,
  ownerConfirmationCategories,
  sensitiveActionRegistry
} from "../index.ts";

describe("sensitive action registry", () => {
  it("registers every required sensitive action category", () => {
    expect(sensitiveActionRegistry.map((entry) => entry.category)).toEqual(
      ownerConfirmationCategories
    );
    expect(getSensitiveActionRegistryEntry("ai_video_output")?.approvalRequirement).toBe(
      "owner_review_required"
    );
  });

  it("contains always-blocked actions", () => {
    expect(alwaysBlockedActionKeys).toContain("delete_audit_logs");
    expect(alwaysBlockedActionKeys).toContain("change_payout_destination");
    expect(isAlwaysBlockedActionKey("publish_fake_reviews_proof")).toBe(true);
  });
});
