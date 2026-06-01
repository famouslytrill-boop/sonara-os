import { createInfrastructureReport, type InfrastructureModule } from "../shared/index.ts";

export const buildPriorityMatrixModule: InfrastructureModule = {
  id: "project-execution.build-priority-matrix",
  publicName: "Build Priority Matrix",
  internalName: "BuildPriorityMatrixEngine",
  description:
    "Safe typed scaffold for Build Priority Matrix; production behavior requires human review and explicit enablement.",
  featureFlag: "PROJECT_EXECUTION_SPINE_ENABLED",
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

export function createBuildPriorityMatrixReport() {
  return createInfrastructureReport(buildPriorityMatrixModule);
}
