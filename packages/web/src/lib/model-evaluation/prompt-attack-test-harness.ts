import { createInfrastructureReport, type InfrastructureModule } from "../shared/index.ts";

export const promptAttackTestHarnessModule: InfrastructureModule = {
  id: "model-evaluation.prompt-attack-test-harness",
  publicName: "Prompt Attack Test Harness",
  internalName: "PromptAttackTestHarnessEngine",
  description:
    "Safe typed scaffold for Prompt Attack Test Harness; production behavior requires human review and explicit enablement.",
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

export function createPromptAttackTestHarnessReport() {
  return createInfrastructureReport(promptAttackTestHarnessModule);
}
