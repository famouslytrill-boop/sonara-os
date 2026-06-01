import { getSignalEnv, isSupabaseConfigured } from "./env.ts";

const env = getSignalEnv();

export const featureFlags = {
  mutationLab: true,
  exportForge: true,
  soundEngine: env.enableSound,
  microphoneReadiness: env.enableMic,
  videoReadiness: env.enableVideo,
  supabaseAuth: isSupabaseConfigured(),
  qdrantMemory: false,
  betaFeedback: true
} as const;

export type FeatureFlagName = keyof typeof featureFlags;

export function isFeatureEnabled(flag: FeatureFlagName): boolean {
  return featureFlags[flag];
}
