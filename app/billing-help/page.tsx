import { PublicShell } from "../../components/PublicShell";

export default function BillingHelpPage() {
  return (
    <PublicShell>
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#2DD4BF]">Billing help</p>
        <h1 className="mt-3 text-4xl font-black text-white">Billing setup and support</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[#CBD5E1]">
          Paid checkout uses Stripe-hosted flows when configured. Refunds, disputes, invoices, subscriptions, and payout
          timing are handled through Stripe and require owner/admin review before action.
        </p>
      </section>
    </PublicShell>
  );
}
