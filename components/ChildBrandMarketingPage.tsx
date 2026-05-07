import Link from "next/link";
import { PublicShell } from "./PublicShell";
import { getHouseBrand, type HouseBrandKey, type HouseBrandSection } from "../lib/houseBrands";

export function ChildBrandLandingPage({ brandKey }: { brandKey: HouseBrandKey }) {
  const brand = getHouseBrand(brandKey);

  return (
    <PublicShell>
      <section className="py-8 sm:py-12">
        <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: brand.accent }}>
          {brand.category}
        </p>
        <h1 className="mt-5 max-w-4xl text-4xl font-black leading-tight text-white sm:text-6xl">{brand.name}</h1>
        <p className="mt-4 max-w-3xl text-2xl font-black text-[#F9FAFB] sm:text-3xl">{brand.tagline}</p>
        <p className="mt-5 max-w-3xl text-base leading-7 text-[#C4BFD0]">
          Built for {brand.audience}. {brand.name} stands independently while SONARA Industries provides
          shared infrastructure, security standards, billing discipline, and operating governance in the background.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <BrandButton href={`${brand.route}/signup`} accent={brand.accent}>Start {brand.name}</BrandButton>
          <BrandButton href={`${brand.route}/pricing`}>View pricing</BrandButton>
          <BrandButton href={`${brand.route}/features`}>Explore features</BrandButton>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <InfoCard title="Who It Is For" accent={brand.accent}>{brand.audience}.</InfoCard>
        <InfoCard title="Problem It Solves" accent={brand.accent}>Focused software for one market, without crossing product boundaries.</InfoCard>
        <InfoCard title="Human Approval" accent={brand.accent}>Risky public, billing, role, or deletion actions stay approval-gated.</InfoCard>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-black text-white">Core Modules</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {brand.modules.map((module) => (
            <InfoCard key={module} accent={brand.accent}>{module}</InfoCard>
          ))}
        </div>
      </section>
    </PublicShell>
  );
}

export function ChildBrandSubPage({
  brandKey,
  section,
}: {
  brandKey: HouseBrandKey;
  section: HouseBrandSection;
}) {
  const brand = getHouseBrand(brandKey);
  const content = getSectionContent(brandKey, section);

  return (
    <PublicShell>
      <section className="py-8">
        <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: brand.accent }}>
          {brand.name}
        </p>
        <h1 className="mt-4 max-w-4xl text-4xl font-black text-white">{content.title}</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-[#C4BFD0]">{content.body}</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <BrandButton href={`${brand.route}/signup`} accent={brand.accent}>Start {brand.name}</BrandButton>
          <BrandButton href={brand.route}>Back to overview</BrandButton>
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        {content.items.map((item) => (
          <InfoCard key={item} accent={brand.accent}>{item}</InfoCard>
        ))}
      </section>
    </PublicShell>
  );
}

function BrandButton({ href, children, accent }: { href: string; children: React.ReactNode; accent?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-12 items-center rounded-xl border border-[#1F2937] bg-[#111827] px-5 text-sm font-black text-white transition hover:-translate-y-0.5"
      style={accent ? { backgroundColor: accent, color: "#0B0F14" } : undefined}
    >
      {children}
    </Link>
  );
}

function InfoCard({ title, accent, children }: { title?: string; accent: string; children: React.ReactNode }) {
  return (
    <article className="rounded-3xl border border-[#1F2937] bg-[#111827] p-5">
      {title ? <h2 className="mb-2 text-lg font-black text-white">{title}</h2> : null}
      <p className="text-sm font-bold leading-6" style={{ color: accent }}>{children}</p>
    </article>
  );
}

function getSectionContent(brandKey: HouseBrandKey, section: HouseBrandSection) {
  const brand = getHouseBrand(brandKey);

  if (section === "features") {
    return { title: `${brand.name} Features`, body: `${brand.name} modules are focused on ${brand.category.toLowerCase()}`, items: [...brand.modules] };
  }

  if (section === "how-it-works") {
    return { title: `How ${brand.name} Works`, body: "Capture the right inputs, organize the workflow, score what needs attention, queue risky actions, and keep humans in control.", items: ["Capture", "Organize", "Score", "Draft", "Approve", "Review"] };
  }

  if (section === "app") {
    return { title: `${brand.name} App`, body: "A public preview of the app shell: dashboard metrics, priority workflow, mode controls, approval state, and clean empty states.", items: ["Beginner Mode", "Operator Mode", "Expert Mode", "Approval Mode", "Dashboard Metrics", "Priority Workflow"] };
  }

  if (section === "pricing") {
    return { title: `${brand.name} Pricing`, body: "Pricing placeholders are for launch planning. Production Stripe price IDs must be configured before paid users go live.", items: [...brand.pricing] };
  }

  if (section === "security") {
    return { title: `${brand.name} Security`, body: "Security follows organization scope, product scope, role checks, audit logs, approval queues, and least-privilege access.", items: ["Organization Scope", "Role Checks", "Audit Logs", "Approval Queues", "Safe Links", "No Risky Auto-Publish"] };
  }

  return { title: `${brand.name} Resources`, body: "Tutorials and launch-readiness resources for learning the product before production data is connected.", items: ["Getting Started", "Workflow Checklist", "Security Basics", "Launch Readiness", "Approval Guide", "Support Paths"] };
}
