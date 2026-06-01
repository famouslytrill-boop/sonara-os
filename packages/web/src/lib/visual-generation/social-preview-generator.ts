import { createInfrastructureReport, type InfrastructureModule } from "../shared/index.ts";

export const socialPreviewGeneratorModule: InfrastructureModule = {
  id: "visual-generation.social-preview-generator",
  publicName: "Social Preview Generator",
  internalName: "SocialPreviewGeneratorEngine",
  description:
    "Safe typed scaffold for Social Preview Generator; production behavior requires human review and explicit enablement.",
  featureFlag: "VISUAL_GENERATION_ENGINE_ENABLED",
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

export function createSocialPreviewGeneratorReport() {
  return createInfrastructureReport(socialPreviewGeneratorModule);
}
