import Link from "next/link";
import { PublicShell } from "./PublicShell";
import { getHouseBrand, type HouseBrandKey } from "../lib/houseBrands";

export function ChildBrandSignupPage({ brandKey }: { brandKey: HouseBrandKey }) {
  const brand = getHouseBrand(brandKey);

  return (
    <PublicShell>
      <section className="rounded-3xl border border-[#1F2937] bg-[#111827] p-6">
        <p
          className="text-xs font-black uppercase tracking-[0.22em]"
          style={{ color: brand.accent }}
        >
          Early access
        </p>
        <h1 className="mt-3 max-w-3xl text-4xl font-black text-white">
          Start {brand.name}
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[#C4BFD0]">
          {brand.name} is preparing its launch workspace for {brand.audience}.
          Paid access, production uploads, and organization data should wait
          until authentication, Supabase RLS, Stripe price IDs, and support
          routing are verified.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            className="inline-flex min-h-12 items-center rounded-xl px-5 text-sm font-black text-[#0B0F14]"
            href="/support"
            style={{ backgroundColor: brand.accent }}
          >
            Contact support
          </Link>
          <Link
            className="inline-flex min-h-12 items-center rounded-xl border border-[#1F2937] bg-[#0B0F14] px-5 text-sm font-black text-white"
            href={`${brand.route}/pricing`}
          >
            View pricing
          </Link>
          <Link
            className="inline-flex min-h-12 items-center rounded-xl border border-[#1F2937] bg-[#0B0F14] px-5 text-sm font-black text-white"
            href={brand.route}
          >
            Back to overview
          </Link>
        </div>
      </section>
    </PublicShell>
  );
}
