import { createInfrastructureReport, type InfrastructureModule } from "../shared/index.ts";

export const unsafeInstructionDetectorModule: InfrastructureModule = {
  id: "ai-safety.unsafe-instruction-detector",
  publicName: "Unsafe Instruction Detector",
  internalName: "UnsafeInstructionDetectorEngine",
  description:
    "Safe typed scaffold for Unsafe Instruction Detector; production behavior requires human review and explicit enablement.",
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

export function createUnsafeInstructionDetectorReport() {
  return createInfrastructureReport(unsafeInstructionDetectorModule);
}
