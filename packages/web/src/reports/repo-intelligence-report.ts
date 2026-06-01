import { featureFlags } from "../lib/shared/feature-flags.ts";
import type { SonaraReport } from "./types.ts";

export function createRepoIntelligenceReport(): SonaraReport {
  return {
    ok: true,
    system: "Repo Health",
    publicNames: ["Repo Health"],
    internalEngines: ["RepoIntelligenceInfrastructure"],
    enabled: featureFlags.CODEBASE_KNOWLEDGE_GRAPH_ENABLED,
    safetyRules: ["Feature flag required", "Human review required", "Placeholder status disclosed"],
    nextActions: ["Keep implementation scoped to approved launch sequence."]
  };
}
