import { createInfrastructureReport, type InfrastructureModule } from "../shared/index.ts";

export const evolutionPromptSandboxModule: InfrastructureModule = {
  id: "agent-evolution.evolution-prompt-sandbox",
  publicName: "Evolution Prompt Sandbox",
  internalName: "EvolutionPromptSandboxEngine",
  description:
    "Safe typed scaffold for Evolution Prompt Sandbox; production behavior requires human review and explicit enablement.",
  featureFlag: "AGENT_EVOLUTION_REVIEW_ENABLED",
  products: ["business_builder", "creator_studio", "growth_studio"],
  launchTier: "q1_core",
  riskLevel: "medium",
  publicVisible: false,
  adminOnly: true,
  betaGated: false,
  requiredHumanReview: true,
  connectedEngines: [],
  blockedScope: ["No production data writes", "No destructive commands", "No hidden automation"],
  safetyRules: ["Feature-gated scaffold", "Human review required", "Placeholder status disclosed"]
};

export function createEvolutionPromptSandboxReport() {
  return createInfrastructureReport(evolutionPromptSandboxModule);
}
