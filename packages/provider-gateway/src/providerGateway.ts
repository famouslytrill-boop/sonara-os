import { enforceMusicStyleSafety } from "./musicStyleSafety.ts";
import type { MusicStyleRequest, MusicStyleSafetyResult } from "./musicStyleSafety.ts";

export type ProviderRequest = MusicStyleRequest & Readonly<Record<string, unknown>>;
export type Provider = {
  name?: string;
  complete(request: ProviderRequest): Promise<unknown>;
};
export type ProviderGatewayOptions = {
  provider?: Provider;
  onSafetyDecision?: (safety: MusicStyleSafetyResult) => void;
};
export type ProviderGatewayResponse = Readonly<{
  ok: boolean;
  blocked: boolean;
  provider: string;
  reasons?: readonly string[];
  response?: unknown;
}>;

export function createProviderGateway({ provider, onSafetyDecision }: ProviderGatewayOptions = {}) {
  if (!provider || typeof provider.complete !== "function") {
    throw new Error("Provider Gateway requires a provider with complete(request).");
  }

  return Object.freeze({
    async complete(request: ProviderRequest): Promise<ProviderGatewayResponse> {
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
