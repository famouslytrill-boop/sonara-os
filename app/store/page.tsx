import Link from "next/link";
import { Package, ShoppingBag } from "lucide-react";
import { PublicShell } from "../../components/PublicShell";
import { PricingTiers } from "../../components/PricingTiers";
import { StoreProductReadinessCard } from "../../components/sonara/StoreProductReadinessCard";
import { areStripeSubscriptionsConfigured, storeProducts } from "../../config/pricing";

export default function StorePage() {
  const paymentsConfigured = areStripeSubscriptionsConfigured();

  return (
    <PublicShell>
      <section className="rounded-lg border border-[#2A2A35] bg-[#171720] p-5 text-[#F8FAFC]">
        <p className="text-xs font-black uppercase text-[#22D3EE]">Store</p>
        <h1 className="mt-2 text-3xl font-black">SONARA Store.</h1>
        <p className="mt-3 max-w-3xl leading-7 text-[#A1A1AA]">
          Subscribe to SONARA OS™ or prepare for future export bundles, prompt packs, sound-pack license sheets, and creator brand kits.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link className="inline-flex min-h-11 items-center rounded-lg bg-[#8B5CF6] px-4 text-sm font-bold text-white" href="/pricing">
            View subscriptions
          </Link>
          <Link className="inline-flex min-h-11 items-center rounded-lg border border-[#2A2A35] bg-[#111118] px-4 text-sm font-bold text-[#F8FAFC]" href="/login">
            Login
          </Link>
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center gap-2">
          <ShoppingBag className="text-[#22D3EE]" size={20} />
          <h2 className="text-xl font-black text-[#F8FAFC]">Subscriptions</h2>
        </div>
        <PricingTiers paymentsConfigured={paymentsConfigured} />
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center gap-2">
          <Package className="text-[#22D3EE]" size={20} />
          <h2 className="text-xl font-black text-[#F8FAFC]">One-time products</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {storeProducts.map((product) => (
            <article key={product.id} className="rounded-lg border border-[#2A2A35] bg-[#171720] p-4">
              <p className="text-sm font-black text-[#F8FAFC]">{product.name}</p>
              <p className="mt-2 min-h-16 text-sm leading-6 text-[#A1A1AA]">{product.description}</p>
              <span className="mt-4 inline-flex min-h-10 items-center rounded-lg border border-[#2A2A35] bg-[#111118] px-3 text-xs font-black uppercase text-[#A1A1AA]">
                Coming soon
              </span>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <StoreProductReadinessCard />
      </section>
    </PublicShell>
  );
}
