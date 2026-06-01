import { describe, expect, it } from "vitest";
import { agentOrchestrationFeatureFlags, evaluateAgentAction } from "./index.ts";

describe("agent orchestration guard", () => {
  it("allows draft-only work and blocks risky autonomy", () => {
    expect(evaluateAgentAction("draft")).toMatchObject({ allowed: true });
    expect(evaluateAgentAction("production_deploy")).toMatchObject({
      allowed: false,
      approvalRequired: true
    });
    expect(evaluateAgentAction("payout_change")).toMatchObject({ blocked: true });
    expect(agentOrchestrationFeatureFlags.AUTO_INSTALL_UNKNOWN_TOOLS).toBe(false);
  });
});
