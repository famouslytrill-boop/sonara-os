import Link from "next/link";
import { ArrowRight, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { BrandLogo } from "../components/brand/BrandLogo";
import { PublicShell } from "../components/PublicShell";
import { JsonLd } from "../components/seo/JsonLd";
import { products, sharedInfrastructure } from "../lib/houseBrands";

const whoFor = [
  "Business owners who need proof, payment, booking, records, and daily operations in one place.",
  "Creators who need asset records, launch planning, rights notes, offers, and monetization readiness.",
  "Growth teams that need campaigns, referrals, reviews, follow-up, and research without deceptive automation.",
] as const;

const howItWorks = [
  "Choose the company workspace that matches the job.",
  "Follow a guided setup path with honest missing-item warnings.",
  "Connect payments, records, files, and campaigns only when configured.",
  "Keep risky actions gated behind human approval.",
] as const;

const previewSections = [
  {
    title: "Research Lab",
    eyebrow: "Governed research",
    body: "Track useful open-source tools, AI systems, creative software, and infrastructure patterns before anything is copied, installed, vendored, or exposed to users.",
    href: "/research-lab",
  },
  {
    title: "Proof-to-Payment",
    eyebrow: "Payment readiness",
    body: "Connect proof, offers, booking paths, and payment links without storing raw card data, taking custody of funds, or making fake revenue promises.",
    href: "/trust",
  },
  {
    title: "Trust Shield",
    eyebrow: "Approval boundaries",
    body: "Customer messages, public claims, payment changes, legal text, security settings, and destructive actions stay review-gated.",
    href: "/trust",
  },
] as const;

const operatingPreviews = [
  {
    title: "Creator tooling preview",
    body: "Asset records, release planning, rights notes, creator offers, prompt playbooks, and tool-library references stay organized without claiming automatic rights clearance.",
    href: "/creator-studio",
  },
  {
    title: "Growth intelligence preview",
    body: "Campaigns, reviews, referrals, follow-up, and recommendations are explainable planning surfaces. No spam automation, fake urgency, or deceptive ranking.",
    href: "/growth-studio",
  },
] as const;

export default function HomePage() {
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "SONARA Industries",
    url: "https://sonaraindustries.com",
    brand: products.map((product) => ({
      "@type": "Brand",
      name: product.name,
      url: `https://sonaraindustries.com${product.route}`,
    })),
  };

  return (
    <PublicShell>
      <JsonLd data={organizationSchema} />
      <section className="grid gap-10 py-4 lg:grid-cols-[1fr_0.82fr] lg:items-center">
        <div>
          <BrandLogo entitySlug="parent-company" showTagline size="md" />
          <h1 className="mt-8 max-w-4xl text-5xl font-black leading-[1.02] text-white sm:text-6xl lg:text-7xl">
            Build. Create. Grow.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-[#CBD5E1]">
            SONARA Industries powers Business Builder, Creator Studio, and Growth Studio through shared infrastructure
            engineered for trust, speed, and scale.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#2DD4BF] px-5 text-sm font-black text-[#07111F] transition hover:bg-[#5EEAD4] focus:outline-none focus:ring-2 focus:ring-[#A7F3D0]"
              href="/onboarding"
            >
              Start setup <ArrowRight size={16} />
            </Link>
            <Link
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-5 text-sm font-black text-white transition hover:border-[#2DD4BF] focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]"
              href="/pricing"
            >
              View pricing
            </Link>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 shadow-[0_24px_100px_rgba(0,0,0,0.38)]">
          <p className="px-2 pb-3 text-xs font-black uppercase tracking-[0.18em] text-[#99F6E4]">
            Three companies. One trusted foundation.
          </p>
          <div className="grid gap-3">
            {products.map((product) => (
              <Link
                key={product.route}
                href={product.route}
                className="rounded-2xl border border-white/10 bg-[#081827] p-4 transition hover:-translate-y-0.5 hover:border-[#2DD4BF] focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-lg font-black text-white">{product.name}</p>
                  <ArrowRight size={18} style={{ color: product.accent }} />
                </div>
                <p className="mt-2 text-sm leading-6 text-[#CBD5E1]">{product.positioning}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-3">
        {products.map((product) => (
          <article key={product.route} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="h-1.5 w-24 rounded-full" style={{ background: product.accent }} />
            <h2 className="mt-5 text-2xl font-black text-white">{product.name}</h2>
            <p className="mt-3 text-sm leading-6 text-[#CBD5E1]">{product.tagline}</p>
            <Link
              href={product.route}
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-black text-white hover:border-[#2DD4BF] focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]"
            >
              Explore <ArrowRight size={16} />
            </Link>
          </article>
        ))}
      </section>

      <section className="mt-10 grid gap-4 lg:grid-cols-3">
        {previewSections.map((section) => (
          <article key={section.title} className="rounded-3xl border border-white/10 bg-[#081827] p-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#99F6E4]">{section.eyebrow}</p>
            <h2 className="mt-3 text-2xl font-black text-white">{section.title}</h2>
            <p className="mt-3 text-sm leading-6 text-[#CBD5E1]">{section.body}</p>
            <Link
              href={section.href}
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-black text-white hover:border-[#2DD4BF] focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]"
            >
              Review details <ArrowRight size={16} />
            </Link>
          </article>
        ))}
      </section>

      <section className="mt-10 rounded-3xl border border-white/10 bg-[#081827] p-6">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-1 shrink-0 text-[#2DD4BF]" size={22} />
          <div>
            <h2 className="text-2xl font-black text-white">Shared infrastructure that gives each company leverage.</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-[#CBD5E1]">
              The platform is built around reusable trust, billing, setup, records, access, and governance systems.
              The product surfaces stay clear and customer-facing.
            </p>
          </div>
        </div>
        <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {sharedInfrastructure.slice(0, 12).map((item) => (
            <div key={item} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-[#E2E8F0]">
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10 grid gap-5 lg:grid-cols-2">
        {operatingPreviews.map((preview) => (
          <article key={preview.title} className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-2xl font-black text-white">{preview.title}</h2>
            <p className="mt-3 text-sm leading-6 text-[#CBD5E1]">{preview.body}</p>
            <Link
              href={preview.href}
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-black text-white hover:border-[#2DD4BF] focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]"
            >
              Open workspace <ArrowRight size={16} />
            </Link>
          </article>
        ))}
      </section>

      <section className="mt-10 grid gap-5 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-2xl font-black text-white">Who it is for</h2>
          <div className="mt-5 grid gap-3">
            {whoFor.map((item) => (
              <p key={item} className="flex gap-3 text-sm leading-6 text-[#CBD5E1]">
                <CheckCircle2 className="mt-1 shrink-0 text-[#2DD4BF]" size={17} />
                <span>{item}</span>
              </p>
            ))}
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-2xl font-black text-white">How it works</h2>
          <div className="mt-5 grid gap-3">
            {howItWorks.map((item, index) => (
              <p key={item} className="flex gap-3 text-sm leading-6 text-[#CBD5E1]">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2DD4BF] text-xs font-black text-[#07111F]">
                  {index + 1}
                </span>
                <span>{item}</span>
              </p>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-10 grid gap-5 lg:grid-cols-[1fr_0.72fr]">
        <div className="rounded-3xl border border-white/10 bg-[#081827] p-6">
          <ShieldCheck className="text-[#2DD4BF]" size={26} />
          <h2 className="mt-4 text-2xl font-black text-white">Trust and security stay visible.</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#CBD5E1]">
            Sensitive actions, payment setup, customer communication, data deletion, AI outputs, and policy changes are
            designed to require review. The site does not claim guaranteed revenue, guaranteed compliance, or guaranteed
            cybersecurity.
          </p>
          <Link
            href="/trust"
            className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-white px-4 text-sm font-black text-[#07111F]"
          >
            Read trust model
          </Link>
        </div>
        <div className="rounded-3xl border border-[#2DD4BF]/30 bg-[#2DD4BF]/10 p-6">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-[#99F6E4]">Pricing preview</p>
          <h2 className="mt-3 text-2xl font-black text-white">Start free. Add paid systems when ready.</h2>
          <p className="mt-3 text-sm leading-6 text-[#CBD5E1]">
            Pricing includes Free, Starter, Core, Growth, Pro, Agency/Scale, and setup service options. Provider costs
            are documented separately when they apply.
          </p>
          <Link href="/pricing" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[#2DD4BF] px-4 text-sm font-black text-[#07111F]">
            Compare plans
          </Link>
        </div>
      </section>

      <section className="mt-10 rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-center">
        <h2 className="text-3xl font-black text-white">Build. Prove. Get paid. Grow.</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[#CBD5E1]">
          Start with the product path that matches your work. Keep setup honest. Add integrations only after they are configured.
        </p>
        <Link
          href="/onboarding"
          className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#2DD4BF] px-5 text-sm font-black text-[#07111F]"
        >
          Choose your path
        </Link>
      </section>
    </PublicShell>
  );
}
