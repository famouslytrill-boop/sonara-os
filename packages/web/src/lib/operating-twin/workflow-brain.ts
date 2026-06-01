import { createInfrastructureReport, type InfrastructureModule } from "../shared/index.ts";

export const workflowBrainModule: InfrastructureModule = {
  id: "operating-twin.workflow-brain",
  publicName: "Workflow Brain",
  internalName: "WorkflowBrainEngine",
  description:
    "Safe typed scaffold for Workflow Brain; production behavior requires human review and explicit enablement.",
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

export function createWorkflowBrainReport() {
  return createInfrastructureReport(workflowBrainModule);
}
