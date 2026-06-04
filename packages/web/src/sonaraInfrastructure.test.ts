import { describe, expect, it } from "vitest";
import { evaluateFinalLaunchHardening } from "./lib/final-launch-hardening/final-launch-hardening-engine.ts";
import { getQ1BuildOrder } from "./lib/implementation-sequencer/build-order-planner.ts";
import { classifyLaunchScope } from "./lib/project-execution/project-execution-spine.ts";
import { evaluateLaunchSecurityAction } from "./lib/security/launch-security-gate.ts";
import { evaluateTrustShieldAction } from "./lib/security/trust-shield.ts";
import { areUnsafeFlagsDisabled, featureFlags } from "./lib/shared/feature-flags.ts";
import { validateInfrastructureRegistry } from "./lib/shared/validate-infrastructure-registry.ts";
import { createImplementationSequencerReport } from "./reports/implementation-sequencer-report.ts";
import { createSecurityReport } from "./reports/security-report.ts";

describe("SONARA Industries v101 infrastructure", () => {
  it("keeps unsafe flags disabled and registry entries valid", () => {
    expect(areUnsafeFlagsDisabled()).toBe(true);
    expect(featureFlags.IMPLEMENTATION_SEQUENCER_ENABLED).toBe(true);
    expect(validateInfrastructureRegistry()).toMatchObject({ ok: true });
  });

  it("blocks unsafe safety gate actions", () => {
    expect(evaluateTrustShieldAction("run destructive commands").allowed).toBe(false);
    expect(evaluateLaunchSecurityAction("publish with secrets in debug logs").allowed).toBe(false);
  });

  it("preserves the Q1 build sequence", () => {
    const order = getQ1BuildOrder();
    expect(order[0]).toBe("Shared feature flags and registries");
    expect(order.at(-1)).toBe("Implementation Sequencer");
  });

  it("classifies launch scope and blocks failed readiness", () => {
    expect(classifyLaunchScope("Business Builder")).toBe("q1_core");
    expect(classifyLaunchScope("Advanced Debugger")).toBe("beta_or_admin");
    expect(
      evaluateFinalLaunchHardening({
        lintPassed: true,
        typecheckPassed: true,
        buildPassed: false,
        securityReviewed: true,
        paymentReviewed: true,
        privacyReviewed: true
      }).allowed
    ).toBe(false);
  });

  it("returns report objects", () => {
    expect(createSecurityReport()).toMatchObject({ ok: true, system: "Trust Shield" });
    expect(createImplementationSequencerReport()).toMatchObject({
      ok: true,
      system: "Implementation Sequencer"
    });
  });
});
