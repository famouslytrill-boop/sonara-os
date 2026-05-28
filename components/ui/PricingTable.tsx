import { pricingTiers } from "../../config/pricing";

export function PricingTable() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {pricingTiers.map((tier) => (
        <article key={tier.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-sm font-black text-white">{tier.name}</p>
          <p className="mt-2 text-3xl font-black text-[#2DD4BF]">{tier.priceLabel}</p>
          <p className="mt-3 text-sm leading-6 text-[#CBD5E1]">{tier.description}</p>
          <ul className="mt-4 grid gap-2 text-sm text-[#CBD5E1]">
            {tier.features.map((feature) => (
              <li key={feature} className="rounded-xl border border-white/10 bg-[#081827] px-3 py-2">
                {feature}
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}
