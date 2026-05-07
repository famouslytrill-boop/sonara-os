import { DivisionShell } from "@/components/layout/DivisionShell";
import { PricingCard } from "@/components/ui/PricingCard";
import { pricing } from "@/lib/pricing";

export default function Page() {
  return (
    <DivisionShell division="music">
      <h1 className="text-4xl font-black text-white">TrackFoundry Pricing</h1>
      <p className="mt-3 max-w-2xl text-white/70">
        Separate product group: TrackFoundry. Billing is scoped to music identity,
        release-readiness, catalog, transcript, and export workflows.
      </p>
      <div className="mt-6 grid-auto">{pricing.soundos.map((plan) => <PricingCard key={plan.name} plan={plan} />)}</div>
    </DivisionShell>
  );
}
