import { BrandShell } from "@/components/layout/BrandShell";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getHouseBrand, type HouseBrandKey, type HouseBrandSection } from "@/lib/houseBrands";

export function ChildBrandLandingPage({ brandKey }: { brandKey: HouseBrandKey }) {
  const brand = getHouseBrand(brandKey);

  return (
    <BrandShell>
      <section className="py-10 md:py-14">
        <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: brand.accent }}>
          {brand.category}
        </p>
        <h1 className="hero-heading mt-5 max-w-4xl font-black text-white">{brand.name}</h1>
        <p className="mt-4 max-w-3xl text-2xl font-black text-slate-100 md:text-3xl">{brand.tagline}</p>
        <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300 md:text-lg">
          Built for {brand.audience}. {brand.name} stands as its own product while SONARA Industries
          provides shared security, billing, infrastructure, and operating standards in the background.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href={`${brand.route}/signup`} variant={brand.buttonVariant}>
            Start {brand.name}
          </ButtonLink>
          <ButtonLink href={`${brand.route}/pricing`} variant="secondary">
            View pricing
          </ButtonLink>
          <ButtonLink href={`${brand.route}/features`} variant="secondary">
            Explore features
          </ButtonLink>
        </div>
      </section>

      <section className="grid-auto">
        <Card title="Who It Serves" accent={brand.accent}>
          <p className="text-sm leading-7 text-slate-300">{brand.audience}.</p>
        </Card>
        <Card title="What It Solves" accent={brand.accent}>
          <p className="text-sm leading-7 text-slate-300">{brand.outcomes[0]}</p>
        </Card>
        <Card title="How It Works" accent={brand.accent}>
          <p className="text-sm leading-7 text-slate-300">{brand.outcomes[1]}</p>
        </Card>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-black text-white">Core Modules</h2>
        <div className="mt-5 grid-auto">
          {brand.modules.map((module) => (
            <Card key={module} accent={brand.accent}>
              <p className="font-black text-slate-50">{module}</p>
            </Card>
          ))}
        </div>
      </section>
    </BrandShell>
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
    <BrandShell>
      <section className="py-10">
        <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: brand.accent }}>
          {brand.name}
        </p>
        <h1 className="app-heading mt-4 max-w-4xl font-black text-white">{content.title}</h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-slate-300 md:text-lg">{content.body}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href={`${brand.route}/signup`} variant={brand.buttonVariant}>
            Start {brand.name}
          </ButtonLink>
          <ButtonLink href={brand.route} variant="secondary">
            Back to overview
          </ButtonLink>
        </div>
      </section>

      <section className="grid-auto">
        {content.items.map((item) => (
          <Card key={item} accent={brand.accent}>
            <p className="text-sm font-black text-slate-50">{item}</p>
          </Card>
        ))}
      </section>
    </BrandShell>
  );
}

function getSectionContent(brandKey: HouseBrandKey, section: HouseBrandSection) {
  const brand = getHouseBrand(brandKey);

  if (section === "features") {
    return {
      title: `${brand.name} Features`,
      body: `${brand.name} brings its primary workflows into a focused product surface for ${brand.audience}.`,
      items: brand.modules,
    };
  }

  if (section === "how-it-works") {
    return {
      title: `How ${brand.name} Works`,
      body: `${brand.name} follows a simple pattern: collect the right inputs, organize the daily workflow, score what needs attention, and route risky actions to human approval.`,
      items: ["Capture", "Organize", "Score", "Prepare", "Approve", "Review"],
    };
  }

  if (section === "app") {
    return {
      title: `${brand.name} App Preview`,
      body: `The ${brand.name} app shell is designed for clear daily work, progressive detail, and approval-aware operations without forcing every advanced control onto the first screen.`,
      items: ["Dashboard metrics", "Priority workflow", "Beginner mode", "Operator mode", "Expert mode", "Approval mode"],
    };
  }

  if (section === "pricing") {
    return {
      title: `${brand.name} Pricing`,
      body: "Pricing placeholders are shown for launch planning. Production Stripe price IDs must be configured with environment variables before paid users go live.",
      items: brand.pricing.map(([name, price, description]) => `${name} - ${price}: ${description}`),
    };
  }

  if (section === "security") {
    return {
      title: `${brand.name} Security`,
      body: `${brand.name} uses organization scope, product scope, role checks, audit logs, approval queues, and least-privilege access patterns inherited from SONARA Industries shared infrastructure.`,
      items: ["Organization-scoped access", "Role-based controls", "Audit logging", "Approval queues", "Safe external links", "No risky auto-publishing"],
    };
  }

  return {
    title: `${brand.name} Resources`,
    body: `Resources help users learn ${brand.name} before they connect production data, billing, or public workflows.`,
    items: brand.resources,
  };
}
