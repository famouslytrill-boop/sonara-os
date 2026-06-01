import { describe, expect, it } from "vitest";
import {
  classifyActionCategory,
  classifyActionRisk,
  getOwnerApprovalRequirement,
  isUnknownSensitiveAction
} from "../index.ts";

describe("action risk classifier", () => {
  it("classifies known sensitive actions", () => {
    expect(
      classifyActionRisk({
        actionKey: "issue_refund",
        category: "refunds",
        productArea: "Billing",
        title: "Issue refund",
        description: "Refund request",
        triggeredBy: "support"
      })
    ).toBe("high");
  });

  it("defaults unknown sensitive actions to owner review", () => {
    const action = {
      actionKey: "new_sensitive_surface",
      category: "new_category",
      productArea: "Unknown",
      title: "Unknown",
      description: "Unknown sensitive action",
      triggeredBy: "automation"
    };
    expect(classifyActionCategory(action)).toBe("unknown");
    expect(classifyActionRisk(action)).toBe("high");
    expect(getOwnerApprovalRequirement(action)).toBe("owner_review_required");
    expect(isUnknownSensitiveAction(action)).toBe(true);
  });

  it("classifies always-blocked action keys as critical", () => {
    const action = {
      actionKey: "change_payout_destination",
      category: "payout_settings",
      productArea: "Billing",
      title: "Change payout destination",
      description: "Change destination",
      triggeredBy: "automation"
    };
    expect(classifyActionRisk(action)).toBe("critical");
    expect(getOwnerApprovalRequirement(action)).toBe("blocked_always");
  });
});
