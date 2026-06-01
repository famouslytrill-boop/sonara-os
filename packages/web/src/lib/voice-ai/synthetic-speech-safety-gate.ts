import { createInfrastructureReport, type InfrastructureModule } from "../shared/index.ts";

export const syntheticSpeechSafetyGateModule: InfrastructureModule = {
  id: "voice-ai.synthetic-speech-safety-gate",
  publicName: "Synthetic Speech Safety Gate",
  internalName: "SyntheticSpeechSafetyGateEngine",
  description:
    "Safe typed scaffold for Synthetic Speech Safety Gate; production behavior requires human review and explicit enablement.",
  featureFlag: "VOICE_AI_AUDIO_LAYER_ENABLED",
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

export function createSyntheticSpeechSafetyGateReport() {
  return createInfrastructureReport(syntheticSpeechSafetyGateModule);
}
