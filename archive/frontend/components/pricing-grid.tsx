import type { BrandDefinition } from "../lib/brand-registry";

export function PricingGrid({ brand }: { brand: BrandDefinition }) {
  return (
    <section className="grid gap-4 lg:grid-cols-3">
      {brand.pricing.map((tier) => (
        <article key={tier.name} className="rounded-xl border border-white/10 bg-white/[0.04] p-5 text-white">
          <p className="text-sm font-black">{tier.name}</p>
          <p className="mt-2 text-3xl font-black" style={{ color: brand.theme.accent2 }}>
            {tier.price}
          </p>
          <p className="mt-2 text-sm text-slate-300">{tier.audience}</p>
          <ul className="mt-4 grid gap-2 text-sm text-slate-300">
            {tier.features.map((feature) => (
              <li key={feature} className="flex gap-2">
                <span style={{ color: brand.theme.accent2 }}>•</span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 rounded-lg border border-white/10 bg-black/25 p-3 text-xs text-slate-400">
            Stripe price env: <span className="font-mono text-slate-200">{tier.stripePriceEnv}</span>
          </p>
        </article>
      ))}
    </section>
  );
}
