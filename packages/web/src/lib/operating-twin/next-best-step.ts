import { createInfrastructureReport, type InfrastructureModule } from "../shared/index.ts";

export const nextBestStepModule: InfrastructureModule = {
  id: "operating-twin.next-best-step",
  publicName: "Next Best Step",
  internalName: "NextBestStepEngine",
  description:
    "Safe typed scaffold for Next Best Step; production behavior requires human review and explicit enablement.",
  featureFlag: "SONARA_OPERATING_TWIN_ENABLED",
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

export function createNextBestStepReport() {
  return createInfrastructureReport(nextBestStepModule);
}
