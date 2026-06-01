import { ReadinessAppPage } from "@/components/ReadinessAppPage";
import { providerRegistry } from "@/data/provider-registry";

export default function AdminProviderRegistryPage() {
  return (
    <ReadinessAppPage
      title="Provider Registry"
      description="Review provider readiness, required env vars, risk labels, and setup gates before enabling integrations."
      cards={providerRegistry.map((provider) => ({
        title: provider.name,
        body: `${provider.category}. Required review: ${provider.humanReviewRequired ? "yes" : "no"}. Server-only env: ${provider.serverOnlyEnv.join(", ") || "none"}.`,
        status: provider.risk,
      }))}
    />
  );
}
