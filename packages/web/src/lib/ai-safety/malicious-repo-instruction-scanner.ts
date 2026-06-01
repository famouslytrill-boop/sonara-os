import { createInfrastructureReport, type InfrastructureModule } from "../shared/index.ts";

export const maliciousRepoInstructionScannerModule: InfrastructureModule = {
  id: "ai-safety.malicious-repo-instruction-scanner",
  publicName: "Malicious Repo Instruction Scanner",
  internalName: "MaliciousRepoInstructionScannerEngine",
  description:
    "Safe typed scaffold for Malicious Repo Instruction Scanner; production behavior requires human review and explicit enablement.",
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

export function createMaliciousRepoInstructionScannerReport() {
  return createInfrastructureReport(maliciousRepoInstructionScannerModule);
}
