export type SonaraAIProvider = "local_rules" | "openai_byok" | "ollama_local" | "lmstudio_local";

export const DEFAULT_AI_PROVIDER: SonaraAIProvider = "local_rules";

export function getAIProvider(): SonaraAIProvider {
  const provider = process.env.SONARA_AI_PROVIDER as SonaraAIProvider | undefined;

  if (provider === "openai_byok" || provider === "ollama_local" || provider === "lmstudio_local") {
    return provider;
  }

  return DEFAULT_AI_PROVIDER;
}

export function hasOpenAIKey() {
  return Boolean(process.env.OPENAI_API_KEY);
}
