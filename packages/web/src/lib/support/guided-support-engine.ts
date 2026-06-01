import { createInfrastructureReport, type InfrastructureModule } from "../shared/index.ts";

export const guidedSupportEngineModule: InfrastructureModule = {
  id: "support.guided-support-engine",
  publicName: "Guided Support",
  internalName: "GuidedSupportEngine",
  description:
    "Safe typed scaffold for Guided Support; production behavior requires human review and explicit enablement.",
  featureFlag: "GUIDED_SUPPORT_ENGINE_ENABLED",
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

export function createGuidedSupportEngineReport() {
  return createInfrastructureReport(guidedSupportEngineModule);
}
