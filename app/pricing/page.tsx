import { PricingTiers } from "../../components/PricingTiers";
import { PublicShell } from "../../components/PublicShell";
import { BrandColorSwatches } from "../../components/brand/BrandColorSwatches";
import { areStripeSubscriptionsConfigured, futurePricingTiers } from "../../config/pricing";

export default function PricingPage() {
  const paymentsConfigured = areStripeSubscriptionsConfigured();

  return (
    <PublicShell>
      <section className="rounded-3xl border border-[#1F2937] bg-[#111827] p-6 text-white">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#00E5FF]">Pricing</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-black">Product access with clear setup boundaries.</h1>
        <p className="mt-3 max-w-3xl leading-7 text-[#C4BFD0]">
          Pricing surfaces should stay honest: checkout only works when Stripe products, prices, environment variables,
          and webhook handling are configured and verified.
        </p>
        {!paymentsConfigured ? (
          <p className="mt-4 rounded-xl border border-[#FFB020]/40 bg-[#FFB020]/10 p-3 text-sm font-bold text-white">
            Stripe setup required. Pricing is visible for planning; checkout stays disabled until live settings are configured.
          </p>
        ) : null}
      </section>

      <section className="mt-6">
        <PricingTiers paymentsConfigured={paymentsConfigured} />
      </section>

      <section className="mt-6 grid gap-3 md:grid-cols-2">
        {futurePricingTiers.map((tier) => (
          <article key={tier.name} className="rounded-2xl border border-[#332A40] bg-[#191522] p-4 text-[#F9FAFB]">
            <p className="text-sm font-black">{tier.name}</p>
            <p className="mt-2 text-2xl font-black text-[#FFB020]">{tier.priceLabel}</p>
            <p className="mt-2 text-sm leading-6 text-[#C4BFD0]">{tier.description}</p>
            <span className="mt-4 inline-flex min-h-10 items-center rounded-xl border border-[#332A40] bg-[#121018] px-3 text-xs font-black uppercase text-[#C4BFD0]">
              {tier.status === "contact_us" ? "Contact us later" : "Future tier"}
            </span>
          </article>
        ))}
      </section>

      <section className="mt-6">
        <BrandColorSwatches />
      </section>
    </PublicShell>
  );
}
