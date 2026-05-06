import { DivisionShell } from "@/components/layout/DivisionShell";
import { PricingCard } from "@/components/ui/PricingCard";
import { pricing } from "@/lib/pricing";

export default function Page() {
  return (
    <DivisionShell division="tableops">
      <h1 className="text-4xl font-black text-white">TableOS Pricing</h1>
      <p className="mt-3 max-w-2xl text-white/70">
        Separate product group: tableos. Billing is scoped to restaurant operations,
        recipe R&D, costing, prep, training, inventory, and menu workflows.
      </p>
      <div className="mt-6 grid-auto">{pricing.tableos.map((plan) => <PricingCard key={plan.name} plan={plan} />)}</div>
    </DivisionShell>
  );
}
