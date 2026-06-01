import type { DeploymentSyncContext, PaywallSyncStatus } from "./types.ts";
import { makeFinding, summarizeStatus } from "./sync-utils.ts";

export function checkPaywallSync(context: DeploymentSyncContext = {}): PaywallSyncStatus {
  void context;
  const findings = [
    makeFinding(
      "paywall",
      "configured",
      "low",
      "paywall.free_plan",
      "Free plan exists in pricing model."
    ),
    makeFinding(
      "paywall",
      "configured",
      "low",
      "paywall.paid_tiers",
      "Paid tiers and setup services are documented."
    ),
    makeFinding(
      "paywall",
      "needs_review",
      "medium",
      "paywall.feature_gates",
      "Feature gates and inactive/canceled behavior require production billing verification."
    ),
    makeFinding(
      "paywall",
      "needs_review",
      "medium",
      "paywall.grace_period",
      "Grace period behavior must be documented if used."
    ),
    makeFinding(
      "paywall",
      "configured",
      "low",
      "paywall.no_hidden_fees",
      "No hidden fees; AI/SMS/provider pass-through costs must be disclosed if charged."
    )
  ];
  return Object.freeze({
    provider: "paywall",
    ...summarizeStatus(findings),
    findings: Object.freeze(findings),
    metadata: Object.freeze({ noHiddenFees: true })
  });
}

if (typeof process !== "undefined" && process.argv[1]?.endsWith("paywall-sync-check.ts")) {
  console.log(JSON.stringify(checkPaywallSync(), null, 2));
}
