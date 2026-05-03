import { ModulePlaceholder } from "@/components/sonara/LaunchShell";
import { ProductDNACard } from "@/components/sonara/ProductDNACard";

export default function FounderPage() {
  return (
    <ModulePlaceholder
      title="Founder Command Center"
      description="Launch readiness, payment setup, Supabase status, Vercel status, and manual blocker tracking."
      cards={[
        {
          title: "Route protection",
          text: "Protect this route before production with real auth and founder/admin authorization.",
          status: "Required",
        },
        {
          title: "Readiness tracking",
          text: "Use this as a future command center for build, Stripe, Supabase, PWA, support, and domain checks.",
          status: "Prepared",
        },
      ]}
    >
      <ProductDNACard />
    </ModulePlaceholder>
  );
}
