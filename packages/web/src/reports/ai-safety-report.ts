import { featureFlags } from "../lib/shared/feature-flags.ts";
import type { SonaraReport } from "./types.ts";

export function createAiSafetyReport(): SonaraReport {
  return {
    ok: true,
    system: "AI Safety",
    publicNames: ["AI Safety"],
    internalEngines: ["AiSafetyInfrastructure"],
    enabled: featureFlags.PROMPT_ATTACK_SHIELD_ENABLED,
    safetyRules: ["Feature flag required", "Human review required", "Placeholder status disclosed"],
    nextActions: ["Keep implementation scoped to approved launch sequence."]
  };
}
