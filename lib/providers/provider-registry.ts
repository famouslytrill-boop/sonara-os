import { providerRegistry, type ProviderRegistryRecord } from "@/data/provider-registry";

export function getProviderRegistry(): ProviderRegistryRecord[] {
  return providerRegistry;
}

export function getProviderBySlug(slug: string): ProviderRegistryRecord | undefined {
  return providerRegistry.find((provider) => provider.slug === slug);
}

export function getProviderReadiness(provider: ProviderRegistryRecord, env: NodeJS.ProcessEnv = process.env) {
  const configuredServerEnv = provider.serverOnlyEnv.filter((key) => Boolean(env[key]));
  const configuredPublicEnv = provider.publicEnv.filter((key) => Boolean(env[key]));
  const requiredConfigured = provider.requiredEnv.every((key) => Boolean(env[key]));

  return {
    configured: requiredConfigured,
    configuredServerEnv,
    configuredPublicEnv,
    missingRequiredEnv: provider.requiredEnv.filter((key) => !env[key]),
  };
}
