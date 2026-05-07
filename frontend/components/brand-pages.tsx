import Link from "next/link";
import type { ReactNode } from "react";
import { AppShellPreview } from "./app-shell-preview";
import { BrandHero } from "./brand-hero";
import { ModuleGrid } from "./module-grid";
import { PricingGrid } from "./pricing-grid";
import { SiteHeader } from "./site-header";
import { brandList, getBrand, parentCompany, riskyActions, type BrandKey } from "../lib/brand-registry";

function PageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#07070A] text-white">
      <SiteHeader />
      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}

export function CorporateHomePage() {
  return (
    <PageFrame>
      <BrandHero eyebrow="Technology holding company" title={parentCompany.name} description={`${parentCompany.positioning} ${parentCompany.tagline}`} />
      <section className="grid gap-4 lg:grid-cols-3">
        {brandList.map((brand) => (
          <Link key={brand.key} href={`/${brand.key}`} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-white/25">
            <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: brand.theme.accent2 }}>
              {brand.category}
            </p>
            <h2 className="mt-3 text-3xl font-black">{brand.name}</h2>
            <p className="mt-2 text-lg font-bold text-slate-200">{brand.tagline}</p>
            <p className="mt-3 text-sm leading-6 text-slate-300">{brand.problem}</p>
          </Link>
        ))}
      </section>
    </PageFrame>
  );
}

export function WebsitesPage() {
  return (
    <PageFrame>
      <BrandHero
        eyebrow="House of brands"
        title="Independent products with shared infrastructure."
        description="TrackFoundry, LineReady, and NoticeGrid each serve a different market, with security, billing, research, and operating standards owned by SONARA Industries."
      />
      <section className="grid gap-4 lg:grid-cols-3">
        {brandList.map((brand) => (
          <article key={brand.key} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-2xl font-black">{brand.name}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">{brand.audience}</p>
            <p className="mt-3 text-sm font-bold" style={{ color: brand.theme.accent2 }}>
              {brand.theme.description}
            </p>
            <Link href={`/${brand.key}`} className="mt-5 inline-flex min-h-10 items-center rounded-lg border border-white/10 px-3 text-sm font-black text-white">
              View product
            </Link>
          </article>
        ))}
      </section>
    </PageFrame>
  );
}

export function CorporatePricingPage() {
  return (
    <PageFrame>
      <BrandHero eyebrow="Pricing" title="Pricing follows the market, not the parent logo." description="Each independent company has its own plans, customers, and value model. Stripe price IDs stay in environment variables." />
      {brandList.map((brand) => (
        <section key={brand.key} className="grid gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: brand.theme.accent2 }}>
              {brand.name}
            </p>
            <h2 className="mt-2 text-3xl font-black">{brand.tagline}</h2>
          </div>
          <PricingGrid brand={brand} />
        </section>
      ))}
    </PageFrame>
  );
}

export function CorporateSecurityPage() {
  return (
    <PageFrame>
      <BrandHero eyebrow="Security" title="Shared controls, brand-scoped data." description="Users only access their organization and brand scope. Risky automation is drafted, queued, and audited instead of executed directly." />
      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="text-2xl font-black">Core security controls</h2>
          <ul className="mt-4 grid gap-2 text-sm leading-6 text-slate-300">
            {["Organization-level RBAC", "Role-based UI", "Approval queue", "Audit logs", "Secure external link handling", "Upload boundaries", "Dependency scan workflow", "Security headers"].map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </article>
        <article className="rounded-2xl border border-amber-400/30 bg-amber-950/20 p-5">
          <h2 className="text-2xl font-black">Actions requiring approval</h2>
          <ul className="mt-4 grid gap-2 text-sm leading-6 text-slate-300">
            {riskyActions.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </article>
      </section>
    </PageFrame>
  );
}

export function ResearchPage() {
  return (
    <PageFrame>
      <BrandHero
        eyebrow="Research"
        title="Free/open-source-first infrastructure."
        description="SONARA Industries researches reusable formulas, approval patterns, security controls, and data models across independent products without making prediction guarantees."
      />
      <section className="grid gap-4 md:grid-cols-2">
        {["Readiness scoring", "Labor and margin formulas", "Alert risk classification", "Moat and workflow bottleneck scoring", "Approval-first automation", "PostgreSQL-ready schemas"].map((item) => (
          <article key={item} className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-xl font-black">{item}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">Implemented as explainable local formulas or structured approval workflows. Outputs guide decisions; they do not promise perfect prediction.</p>
          </article>
        ))}
      </section>
    </PageFrame>
  );
}

export function BrandLandingPage({ brandKey }: { brandKey: BrandKey }) {
  const brand = getBrand(brandKey);
  return (
    <PageFrame>
      <BrandHero brand={brand} eyebrow={brand.category} title={brand.name} description={`${brand.tagline} ${brand.problem}`} />
      <section className="grid gap-4 lg:grid-cols-[0.85fr_1fr]">
        <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="text-2xl font-black">Who it is for</h2>
          <p className="mt-3 leading-7 text-slate-300">{brand.audience}</p>
          <h2 className="mt-6 text-2xl font-black">How it is owned</h2>
          <p className="mt-3 leading-7 text-slate-300">
            {brand.name} is owned by SONARA Industries, but it stands as its own product with its own market, visual identity, modules, pricing, and user workflows.
          </p>
        </article>
        <ModuleGrid brand={brand} />
      </section>
    </PageFrame>
  );
}

export function BrandFeaturePage({ brandKey }: { brandKey: BrandKey }) {
  const brand = getBrand(brandKey);
  return (
    <PageFrame>
      <BrandHero brand={brand} eyebrow={`${brand.name} features`} title="Modules built around the real workflow." description={brand.problem} />
      <ModuleGrid brand={brand} />
    </PageFrame>
  );
}

export function BrandHowItWorksPage({ brandKey }: { brandKey: BrandKey }) {
  const brand = getBrand(brandKey);
  return (
    <PageFrame>
      <BrandHero brand={brand} eyebrow={`${brand.name} workflow`} title="How it works." description={brand.howItWorks.join(" ")} />
      <section className="grid gap-4 md:grid-cols-3">
        {brand.howItWorks.map((step, index) => (
          <article key={step} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm font-black" style={{ color: brand.theme.accent2 }}>
              Step {index + 1}
            </p>
            <p className="mt-3 text-lg font-bold leading-7">{step}</p>
          </article>
        ))}
      </section>
    </PageFrame>
  );
}

export function BrandAppPage({ brandKey }: { brandKey: BrandKey }) {
  const brand = getBrand(brandKey);
  return (
    <PageFrame>
      <BrandHero brand={brand} eyebrow={`${brand.name} app`} title="A dashboard shell with complexity under control." description="Beginner Mode keeps the first screen clean. Operator, Expert, and Approval modes open only when the job requires them." />
      <AppShellPreview brand={brand} />
    </PageFrame>
  );
}

export function BrandPricingPage({ brandKey }: { brandKey: BrandKey }) {
  const brand = getBrand(brandKey);
  return (
    <PageFrame>
      <BrandHero brand={brand} eyebrow={`${brand.name} pricing`} title="Simple tiers for practical teams." description="Production Stripe price IDs are environment variables. Plans are displayed without hard-coding payment identifiers." />
      <PricingGrid brand={brand} />
    </PageFrame>
  );
}

export function BrandSecurityPage({ brandKey }: { brandKey: BrandKey }) {
  const brand = getBrand(brandKey);
  return (
    <PageFrame>
      <BrandHero brand={brand} eyebrow={`${brand.name} security`} title="Secure by organization, role, and approval state." description="Every product inherits the same core safety posture while keeping brand-specific risks visible." />
      <section className="grid gap-4 md:grid-cols-2">
        {brand.security.map((item) => (
          <article key={item} className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm font-bold leading-6 text-slate-200">{item}</p>
          </article>
        ))}
      </section>
    </PageFrame>
  );
}

export function BrandResourcesPage({ brandKey }: { brandKey: BrandKey }) {
  const brand = getBrand(brandKey);
  return (
    <PageFrame>
      <BrandHero brand={brand} eyebrow={`${brand.name} resources`} title="Tutorials for the operating workflow." description="Resources teach the practical workflow without burying new users in advanced settings." />
      <section className="grid gap-4 md:grid-cols-2">
        {brand.resources.map((item) => (
          <article key={item} className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-xl font-black">{item}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">Beginner Mode starts with the smallest useful action. Expert details stay available when the user needs them.</p>
          </article>
        ))}
      </section>
    </PageFrame>
  );
}
