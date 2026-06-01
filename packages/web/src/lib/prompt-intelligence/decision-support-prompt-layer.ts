import { createInfrastructureReport, type InfrastructureModule } from "../shared/index.ts";

export const decisionSupportPromptLayerModule: InfrastructureModule = {
  id: "prompt-intelligence.decision-support-prompt-layer",
  publicName: "Decision Support Prompt",
  internalName: "DecisionSupportPromptLayer",
  description:
    "Safe typed scaffold for Decision Support Prompt; production behavior requires human review and explicit enablement.",
  featureFlag: "GUIDED_QUESTION_INTELLIGENCE_ENABLED",
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

export function createDecisionSupportPromptLayerReport() {
  return createInfrastructureReport(decisionSupportPromptLayerModule);
}
