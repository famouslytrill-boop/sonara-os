import { engineRegistry } from "./engine-registry.ts";
import { coreFeatureFlagDefaults, unsafeFeatureFlagDefaults } from "./feature-flags.ts";
import { moduleRegistry } from "./module-registry.ts";
import { containsBlockedInternalPublicTerm } from "./public-language-map.ts";
import type { RegistryValidationResult } from "./types.ts";

export function validateInfrastructureRegistry(): RegistryValidationResult {
  const issues: string[] = [];
  const flags = new Set([
    ...Object.keys(coreFeatureFlagDefaults),
    ...Object.keys(unsafeFeatureFlagDefaults)
  ]);
  const engineIds = new Set<string>();
  const moduleIds = new Set<string>();

  for (const engine of engineRegistry) {
    if (engineIds.has(engine.id)) issues.push(`Duplicate engine id: ${engine.id}`);
    engineIds.add(engine.id);
    if (!flags.has(engine.featureFlag))
      issues.push(`Missing feature flag for engine: ${engine.id}`);
    if (!engine.publicName) issues.push(`Missing public name for engine: ${engine.id}`);
    if (engine.publicVisible && containsBlockedInternalPublicTerm(engine.publicName)) {
      issues.push(`Internal engine term leaked publicly: ${engine.id}`);
    }
    if ((engine.adminOnly || engine.betaGated) && engine.publicVisible) {
      issues.push(`Admin or beta engine cannot be public by default: ${engine.id}`);
    }
  }

  for (const module of moduleRegistry) {
    if (moduleIds.has(module.id)) issues.push(`Duplicate module id: ${module.id}`);
    moduleIds.add(module.id);
    if (!flags.has(module.featureFlag))
      issues.push(`Missing feature flag for module: ${module.id}`);
    if (module.publicVisible && !module.publicName)
      issues.push(`Public module missing public name: ${module.id}`);
    if (module.publicVisible && containsBlockedInternalPublicTerm(module.publicName)) {
      issues.push(`Internal term leaked in module public name: ${module.id}`);
    }
    if (module.launchPriority === "q1_core" && module.safetyNotes.length === 0) {
      issues.push(`Q1 module missing safety notes: ${module.id}`);
    }
  }

  for (const [flag, enabled] of Object.entries(unsafeFeatureFlagDefaults)) {
    if (enabled !== false) issues.push(`Unsafe flag must remain disabled: ${flag}`);
  }

  if (!flags.has("FINAL_LAUNCH_HARDENING_ENGINE_ENABLED"))
    issues.push("Sprint 100 final launch hardening flag is missing.");
  if (!flags.has("IMPLEMENTATION_SEQUENCER_ENABLED"))
    issues.push("Sprint 101 implementation sequencer flag is missing.");
  if (!flags.has("SCOPE_FREEZE_GUARD_ENABLED")) issues.push("Scope freeze guard flag is missing.");

  return {
    ok: issues.length === 0,
    issues,
    counts: {
      engines: engineRegistry.length,
      modules: moduleRegistry.length,
      flags: flags.size,
      unsafeFlags: Object.keys(unsafeFeatureFlagDefaults).length
    }
  };
}
