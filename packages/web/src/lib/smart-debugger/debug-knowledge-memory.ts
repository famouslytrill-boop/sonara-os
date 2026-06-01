import { createInfrastructureReport, type InfrastructureModule } from "../shared/index.ts";

export const debugKnowledgeMemoryModule: InfrastructureModule = {
  id: "smart-debugger.debug-knowledge-memory",
  publicName: "Debug Knowledge Memory",
  internalName: "DebugKnowledgeMemoryEngine",
  description:
    "Safe typed scaffold for Debug Knowledge Memory; production behavior requires human review and explicit enablement.",
  featureFlag: "PREDICTIVE_CAUSAL_DEBUGGER_ENABLED",
  products: ["business_builder", "creator_studio", "growth_studio"],
  launchTier: "admin_only",
  riskLevel: "medium",
  publicVisible: false,
  adminOnly: true,
  betaGated: false,
  requiredHumanReview: true,
  connectedEngines: [],
  blockedScope: ["No production data writes", "No destructive commands", "No hidden automation"],
  safetyRules: ["Feature-gated scaffold", "Human review required", "Placeholder status disclosed"]
};

export function createDebugKnowledgeMemoryReport() {
  return createInfrastructureReport(debugKnowledgeMemoryModule);
}
