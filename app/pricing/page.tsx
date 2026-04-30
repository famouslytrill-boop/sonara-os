import { PricingTiers } from "../../components/PricingTiers";
import { PublicShell } from "../../components/PublicShell";
import { areStripeSubscriptionsConfigured } from "../../config/pricing";

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
    </PublicShell>
  );
}
