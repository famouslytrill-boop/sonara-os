import type { ProviderHealthStatus } from "../contracts.ts";
export function getProviderHealthStatus(providerId: string): ProviderHealthStatus {
  return { providerId, status: "degraded", latencyMs: undefined, errorRate: undefined };
}
