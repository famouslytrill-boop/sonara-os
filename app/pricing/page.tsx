import { PricingTiers } from "../../components/PricingTiers";
import { PublicShell } from "../../components/PublicShell";
import { areStripeSubscriptionsConfigured, futurePricingTiers } from "../../config/pricing";

export default function PricingPage() {
  const paymentsConfigured = areStripeSubscriptionsConfigured();

  return (
    <PublicShell>
      <section className="rounded-lg border border-[#2A2A35] bg-[#171720] p-5 text-[#F8FAFC]">
        <p className="text-xs font-black uppercase text-[#22D3EE]">Pricing</p>
        <h1 className="mt-2 text-3xl font-black">SONARA OS™ subscriptions.</h1>
        <p className="mt-3 max-w-3xl leading-7 text-[#A1A1AA]">
          Start with local-rules tools, then upgrade when Stripe products, prices, and webhook handling are configured for production.
        </p>
        {!paymentsConfigured ? (
          <p className="mt-4 rounded-lg border border-[#F59E0B] bg-[#21190C] p-3 text-sm font-bold text-[#F8FAFC]">
            Payments are not live yet. Pricing is shown for planning; checkout stays disabled until Stripe environment variables are configured.
          </p>
        ) : null}
      </section>

      <section className="mt-6">
        <PricingTiers paymentsConfigured={paymentsConfigured} />
      </section>

      <section className="mt-6 grid gap-3 md:grid-cols-2">
        {futurePricingTiers.map((tier) => (
          <article key={tier.name} className="rounded-lg border border-[#332A40] bg-[#191522] p-4 text-[#F9FAFB]">
            <p className="text-sm font-black">{tier.name}</p>
            <p className="mt-2 text-2xl font-black text-[#FFB454]">{tier.priceLabel}</p>
            <p className="mt-2 text-sm leading-6 text-[#C4BFD0]">{tier.description}</p>
            <span className="mt-4 inline-flex min-h-10 items-center rounded-lg border border-[#332A40] bg-[#121018] px-3 text-xs font-black uppercase text-[#C4BFD0]">
              {tier.status === "contact_us" ? "Contact us later" : "Future tier"}
            </span>
          </article>
        ))}
      </section>
    </PublicShell>
  );
}
