import { createInfrastructureReport, type InfrastructureModule } from "../shared/index.ts";

export const unsafeOutputQuarantineModule: InfrastructureModule = {
  id: "model-evaluation.unsafe-output-quarantine",
  publicName: "Unsafe Output Quarantine",
  internalName: "UnsafeOutputQuarantineEngine",
  description:
    "Safe typed scaffold for Unsafe Output Quarantine; production behavior requires human review and explicit enablement.",
  featureFlag: "MULTI_MODEL_EVALUATION_ARENA_ENABLED",
  products: ["business_builder", "creator_studio", "growth_studio"],
  launchTier: "q1_core",
  riskLevel: "medium",
  publicVisible: false,
  adminOnly: false,
  betaGated: false,
  requiredHumanReview: true,
  connectedEngines: [],
  blockedScope: ["No production data writes", "No destructive commands", "No hidden automation"],
  safetyRules: ["Feature-gated scaffold", "Human review required", "Placeholder status disclosed"]
};

export function createUnsafeOutputQuarantineReport() {
  return createInfrastructureReport(unsafeOutputQuarantineModule);
}
