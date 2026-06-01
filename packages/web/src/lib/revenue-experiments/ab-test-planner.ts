import { createInfrastructureReport, type InfrastructureModule } from "../shared/index.ts";

export const abTestPlannerModule: InfrastructureModule = {
  id: "revenue-experiments.ab-test-planner",
  publicName: "Ab Test Planner",
  internalName: "AbTestPlannerEngine",
  description:
    "Safe typed scaffold for Ab Test Planner; production behavior requires human review and explicit enablement.",
  featureFlag: "REVENUE_EXPERIMENT_LAB_ENABLED",
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

export function createAbTestPlannerReport() {
  return createInfrastructureReport(abTestPlannerModule);
}
