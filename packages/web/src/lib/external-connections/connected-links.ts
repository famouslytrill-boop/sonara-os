import { createInfrastructureReport, type InfrastructureModule } from "../shared/index.ts";

export const connectedLinksModule: InfrastructureModule = {
  id: "external-connections.connected-links",
  publicName: "Connected Links",
  internalName: "ConnectedLinksEngine",
  description:
    "Safe typed scaffold for Connected Links; production behavior requires human review and explicit enablement.",
  featureFlag: "EXTERNAL_CONNECTIONS_ENGINE_ENABLED",
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

export function createConnectedLinksReport() {
  return createInfrastructureReport(connectedLinksModule);
}
