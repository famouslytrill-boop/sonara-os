import Link from "next/link";
import { ProductShell } from "../../../components/ProductShell";
import { pricingTiers } from "../../../config/pricing";
import { entitlementsByTier } from "../../../lib/sonara/billing/entitlements";
import { getSupabaseStatus } from "../../../lib/supabase";

export default function BillingPage() {
  const supabase = getSupabaseStatus();

  return (
    <ProductShell>
      <section className="rounded-lg border border-[#2A2A35] bg-[#171720] p-5 text-[#F8FAFC]">
        <p className="text-xs font-black uppercase text-[#22D3EE]">Billing</p>
        <h1 className="mt-2 text-3xl font-black">Account billing.</h1>
        <p className="mt-3 max-w-3xl leading-7 text-[#A1A1AA]">
          Subscription state appears here after Supabase and Stripe webhook processing are configured. SONARA never shows fake active subscriptions.
        </p>
        {!supabase.configured ? (
          <p className="mt-4 rounded-lg border border-[#F59E0B] bg-[#21190C] p-3 text-sm font-bold text-[#F8FAFC]">
            Supabase is not configured yet, so account billing is in setup mode.
          </p>
        ) : null}
      </section>

      <section className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {pricingTiers.map((tier) => (
          <article key={tier.id} className="rounded-lg border border-[#2A2A35] bg-[#171720] p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#22D3EE]">{tier.productName}</p>
            <p className="mt-2 text-sm font-black text-[#F8FAFC]">{tier.name}</p>
            <p className="mt-2 text-sm leading-6 text-[#A1A1AA]">{tier.description}</p>
            <p className="mt-4 text-xs font-black uppercase text-[#22D3EE]">Entitlements</p>
            <ul className="mt-2 grid gap-1 text-sm leading-6 text-[#A1A1AA]">
              {(entitlementsByTier[tier.id] ?? tier.features).map((entitlement) => (
                <li key={entitlement}>{entitlement.replaceAll("_", " ")}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <Link className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-[#8B5CF6] px-4 text-sm font-bold text-white" href="/pricing">
        Review pricing
      </Link>
    </ProductShell>
  );
}
