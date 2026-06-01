import {
  detectUnsafeCloneRequest,
  rewriteStyleRequestSafely
} from "../safety/music-style-safety.ts";

export type ProviderName = "openai" | "anthropic" | "google" | "xai" | "local";

export type ProviderTask =
  | "lyrics"
  | "analysis"
  | "marketing"
  | "critique"
  | "metadata"
  | "support";

export interface ProviderRequest {
  provider: ProviderName;
  task: ProviderTask;
  prompt: string;
  userId: string;
  sessionId?: string;
  maxCostUsd?: number;
}

export interface ProviderResponse {
  provider: ProviderName;
  text: string;
  estimatedCostUsd?: number;
  warnings?: string[];
}

export async function routeProviderRequest(request: ProviderRequest): Promise<ProviderResponse> {
  if (request.prompt.length > 60000) {
    throw new Error("Provider prompt is too large for gateway policy.");
  }

  const warnings: string[] = [];
  let prompt = request.prompt;

  if (detectUnsafeCloneRequest(prompt)) {
    prompt = rewriteStyleRequestSafely(prompt);
    warnings.push("Direct artist-cloning language was replaced with rights-safer style guidance.");
  }

  return {
    provider: request.provider,
    text: `Provider gateway ready for ${request.task}. Prompt accepted: ${prompt.slice(0, 180)}`,
    estimatedCostUsd: 0,
    warnings
  };
}
