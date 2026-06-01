import { createInfrastructureReport, type InfrastructureModule } from "../shared/index.ts";

export const agentHardeningLayerModule: InfrastructureModule = {
  id: "ai-safety.agent-hardening-layer",
  publicName: "Agent Hardening",
  internalName: "AgentHardeningLayer",
  description:
    "Safe typed scaffold for Agent Hardening; production behavior requires human review and explicit enablement.",
  featureFlag: "PROMPT_ATTACK_SHIELD_ENABLED",
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

export function createAgentHardeningLayerReport() {
  return createInfrastructureReport(agentHardeningLayerModule);
}
