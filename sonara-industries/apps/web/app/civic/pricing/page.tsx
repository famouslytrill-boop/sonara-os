import { DivisionShell } from "@/components/layout/DivisionShell";
import { PricingCard } from "@/components/ui/PricingCard";
import { pricing } from "@/lib/pricing";

export default function Page() {
  return (
    <DivisionShell division="civic">
      <h1 className="text-4xl font-black text-white">CivicSignal Network Pricing</h1>
      <p className="mt-3 max-w-2xl text-white/70">
        Separate product group: civic_signal. Billing is scoped to public information,
        source-linked feeds, organization profiles, transit notices, and broadcast workflows.
      </p>
      <div className="mt-6 grid-auto">{pricing.civic_signal.map((plan) => <PricingCard key={plan.name} plan={plan} />)}</div>
    </DivisionShell>
  );
}
