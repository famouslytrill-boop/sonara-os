import Link from "next/link";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { BrandLogo } from "./brand/BrandLogo";
import type { SonaraProduct } from "../lib/houseBrands";

type ProductLandingPageProps = {
  product: SonaraProduct;
  sections: {
    title: string;
    body: string;
  }[];
};

export function ProductLandingPage({ product, sections }: ProductLandingPageProps) {
  return (
    <div>
      <section className="grid gap-8 rounded-3xl border border-white/10 bg-white/[0.04] p-6 lg:grid-cols-[1fr_0.78fr] lg:items-center">
        <div>
          <BrandLogo entitySlug={product.slug} showTagline size="md" />
          <h1 className="mt-6 max-w-4xl text-4xl font-black leading-tight text-white sm:text-6xl">
            {product.tagline}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-[#CBD5E1]">{product.positioning}</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/onboarding"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-black text-[#07111F]"
              style={{ background: product.accent }}
            >
              Start setup <ArrowRight size={16} />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/15 px-5 text-sm font-black text-white hover:border-[#2DD4BF]"
            >
              See pricing
            </Link>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#07111F] p-5">
          <p className="text-sm font-black uppercase tracking-[0.18em]" style={{ color: product.accent }}>
            Core modules
          </p>
          <div className="mt-4 grid gap-2">
            {product.modules.map((module) => (
              <div key={module} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-[#E2E8F0]">
                {module}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {product.outcomes.map((outcome) => (
          <article key={outcome} className="rounded-2xl border border-white/10 bg-[#081827] p-5">
            <CheckCircle2 size={20} style={{ color: product.accent }} />
            <p className="mt-3 text-sm font-black text-white">{outcome}</p>
          </article>
        ))}
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        {sections.map((section) => (
          <article key={section.title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-xl font-black text-white">{section.title}</h2>
            <p className="mt-3 text-sm leading-6 text-[#CBD5E1]">{section.body}</p>
          </article>
        ))}
      </section>

      <section className="mt-8 rounded-3xl border border-white/10 bg-[#081827] p-6">
        <div className="flex gap-3">
          <ShieldCheck className="mt-1 shrink-0" size={22} style={{ color: product.accent }} />
          <div>
            <h2 className="text-xl font-black text-white">Trust and approval boundaries</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#CBD5E1]">
              Customer-facing messages, public proof, payment changes, legal/policy edits, security settings, and
              destructive actions require human review. Drafts and recommendations do not execute risky work automatically.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
