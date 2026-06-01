import { ReadinessAppPage } from "@/components/ReadinessAppPage";
import { featureFlags } from "@/lib/infrastructure/feature-flags";

export default function AdminFeatureFlagsPage() {
  return (
    <ReadinessAppPage
      title="Feature Flags"
      description="Feature flags document defaults and owner-review gates. Runtime flag providers are not configured by default."
      cards={featureFlags.slice(0, 12).map((flag) => ({
        title: flag.key,
        body: flag.description,
        status: flag.defaultEnabled ? "Default visible" : "Disabled",
      }))}
    />
  );
}
