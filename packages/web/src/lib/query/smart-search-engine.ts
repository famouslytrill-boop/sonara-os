import { createInfrastructureReport, type InfrastructureModule } from "../shared/index.ts";

export const smartSearchEngineModule: InfrastructureModule = {
  id: "query.smart-search-engine",
  publicName: "Smart Search",
  internalName: "SmartSearchEngine",
  description:
    "Safe typed scaffold for Smart Search; production behavior requires human review and explicit enablement.",
  featureFlag: "QUERY_ENGINE_ENABLED",
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

export function createSmartSearchEngineReport() {
  return createInfrastructureReport(smartSearchEngineModule);
}
