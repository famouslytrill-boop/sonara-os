import { enforceMusicStyleSafety } from "./musicStyleSafety.ts";

export function createProviderGateway({ provider, onSafetyDecision } = {}) {
  if (!provider || typeof provider.complete !== "function") {
    throw new Error("Provider Gateway requires a provider with complete(request).");
  }

  return Object.freeze({
    async complete(request) {
      const safety = enforceMusicStyleSafety(request);
      onSafetyDecision?.(safety);

      if (!safety.allowed) {
        return Object.freeze({
          ok: false,
          blocked: true,
          reasons: safety.reasons,
          provider: provider.name ?? "unknown"
        });
      }

      const response = await provider.complete({
        ...request,
        prompt: safety.safePrompt,
        musicStyle: safety.musicStyle
      });

      return Object.freeze({
        ok: true,
        blocked: false,
        provider: provider.name ?? "unknown",
        response
      });
    }
  });
}
