import type { ProviderRegistryRecord, ProviderRisk } from "@/data/provider-registry";

export function isProviderProductionReady(provider: ProviderRegistryRecord) {
  return provider.status === "configured_by_env" && provider.risk !== "blocked" && provider.humanReviewRequired === false;
}

export function providerRiskLabel(risk: ProviderRisk) {
  const labels: Record<ProviderRisk, string> = {
    allowed: "Allowed after attribution and setup review",
    review_required: "Review required",
    restricted: "Restricted until owner approval",
    blocked: "Blocked",
    reference_only: "Reference only",
  };

  return labels[risk];
}
