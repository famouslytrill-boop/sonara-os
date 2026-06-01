import { describe, expect, it } from "vitest";
import { aiCostControlFeatureFlags, evaluateAiRunCost } from "./index.ts";

describe("AI cost control", () => {
  it("requires approval for expensive runs", () => {
    expect(evaluateAiRunCost(1)).toMatchObject({ allowed: true });
    expect(evaluateAiRunCost(10)).toMatchObject({ ownerApprovalRequired: true });
    expect(evaluateAiRunCost(75)).toMatchObject({ allowed: false });
    expect(aiCostControlFeatureFlags.AUTO_RUN_EXPENSIVE_AI_JOBS).toBe(false);
  });
});
