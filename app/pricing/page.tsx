import Link from "next/link";
import { PricingTiers } from "../../components/PricingTiers";
import { PublicShell } from "../../components/PublicShell";
import { areStripeSubscriptionsConfigured, setupServices } from "../../config/pricing";

const faqs = [
  {
    question: "Are there hidden fees?",
    answer: "No hidden platform fees are listed here. Provider costs such as Stripe fees, SMS, email, storage, or AI usage may apply when those providers are enabled.",
  },
  {
    question: "Does SONARA guarantee revenue or customers?",
    answer: "No. The platform helps organize setup, proof, payments, campaigns, and follow-up. It does not guarantee revenue, customers, growth, or legal outcomes.",
  },
  {
    question: "Can I cancel?",
    answer: "Cancellation and refund handling must follow the billing terms and Stripe account settings. See the refund policy before paid launch.",
  },
  {
    question: "Is this legal, tax, or financial advice?",
    answer: "No. Product guidance and generated drafts are not professional legal, tax, financial, medical, or compliance advice.",
  },
] as const;

export default function PricingPage() {
  const paymentsConfigured = areStripeSubscriptionsConfigured();

  return (
    <PublicShell>
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-white">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#2DD4BF]">Pricing</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-black">Clear plans for building, proving, getting paid, and growing.</h1>
        <p className="mt-3 max-w-3xl leading-7 text-[#CBD5E1]">
          Start free, then add paid systems and setup services when the business is ready. Checkout stays disabled until
          Stripe products, prices, environment variables, and webhook handling are configured.
        </p>
        {!paymentsConfigured ? (
          <p className="mt-4 rounded-xl border border-[#FFB454]/40 bg-[#FFB454]/10 p-3 text-sm font-bold text-white">
            Stripe setup required. Pricing is visible for planning; checkout is safely blocked until live settings are configured.
          </p>
        ) : null}
      </section>

      <section className="mt-6">
        <PricingTiers paymentsConfigured={paymentsConfigured} />
      </section>

      <section className="mt-8 rounded-3xl border border-white/10 bg-[#081827] p-6">
        <h2 className="text-2xl font-black text-white">Setup services</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#CBD5E1]">
          Optional setup services help users get profile, payment, booking, review, and launch basics configured. They do
          not guarantee revenue, customers, compliance, or approval.
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {setupServices.map((service) => (
            <article key={service.name} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-sm font-black text-white">{service.name}</p>
              <p className="mt-2 text-3xl font-black text-[#2DD4BF]">{service.price}</p>
              <p className="mt-2 text-xs text-[#CBD5E1]">Stripe env: `{service.env}`</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        {faqs.map((faq) => (
          <article key={faq.question} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-lg font-black text-white">{faq.question}</h2>
            <p className="mt-2 text-sm leading-6 text-[#CBD5E1]">{faq.answer}</p>
          </article>
        ))}
      </section>

      <section className="mt-8 flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:flex-row">
        <Link className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#2DD4BF] px-5 text-sm font-black text-[#07111F]" href="/legal/refund-policy">
          Refund policy
        </Link>
        <Link className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-5 text-sm font-black text-white" href="/legal/billing-terms">
          Billing terms
        </Link>
      </section>
    </PublicShell>
  );
}
