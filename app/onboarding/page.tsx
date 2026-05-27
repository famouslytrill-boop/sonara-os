import Link from "next/link";
import { PublicShell } from "../../components/PublicShell";
import { products } from "../../lib/houseBrands";

export default function OnboardingPage() {
  return (
    <PublicShell>
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#2DD4BF]">Onboarding</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-black text-white">Choose your SONARA path.</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[#CBD5E1]">
          Setup asks for profile name, category, goal, payment/booking need, proof/review need, customer/contact need,
          and launch readiness status. Saving state requires Supabase configuration.
        </p>
      </section>
      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        {products.map((product) => (
          <Link
            key={product.route}
            href={`/app/${product.slug}`}
            className="rounded-2xl border border-white/10 bg-[#081827] p-5 transition hover:border-[#2DD4BF]"
          >
            <h2 className="text-xl font-black text-white">{product.name}</h2>
            <p className="mt-2 text-sm leading-6 text-[#CBD5E1]">{product.tagline}</p>
            <span className="mt-4 inline-flex min-h-10 items-center rounded-xl border border-white/15 px-3 text-xs font-black text-white">
              Start setup
            </span>
          </Link>
        ))}
      </section>
    </PublicShell>
  );
}
