import { createInfrastructureReport, type InfrastructureModule } from "../shared/index.ts";

export const creatorVoiceWorkflowEngineModule: InfrastructureModule = {
  id: "voice-ai.creator-voice-workflow-engine",
  publicName: "Creator Voice Workflow",
  internalName: "CreatorVoiceWorkflowEngine",
  description:
    "Safe typed scaffold for Creator Voice Workflow; production behavior requires human review and explicit enablement.",
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

export function createCreatorVoiceWorkflowEngineReport() {
  return createInfrastructureReport(creatorVoiceWorkflowEngineModule);
}
