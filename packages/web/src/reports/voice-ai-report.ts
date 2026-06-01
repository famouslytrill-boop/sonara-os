import { featureFlags } from "../lib/shared/feature-flags.ts";
import type { SonaraReport } from "./types.ts";

export function createVoiceAiReport(): SonaraReport {
  return {
    ok: true,
    system: "Audio Notes",
    publicNames: ["Audio Notes"],
    internalEngines: ["VoiceAudioInfrastructure"],
    enabled: featureFlags.VOICE_AI_AUDIO_LAYER_ENABLED,
    safetyRules: ["Feature flag required", "Human review required", "Placeholder status disclosed"],
    nextActions: ["Keep implementation scoped to approved launch sequence."]
  };
}
