import { Card } from "./Card";

export function PricingCard({ plan }: { plan: { name: string; price: string; features: readonly string[] } }) {
  return (
    <Card title={plan.name}>
      <p className="text-3xl font-black text-white">{plan.price}</p>
      <ul className="mt-4 grid gap-2 text-sm text-slate-300">
        {plan.features.map((feature) => (
          <li key={feature}>• {feature}</li>
        ))}
      </ul>
    </Card>
  );
}
