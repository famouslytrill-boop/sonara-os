import { parentCopy } from "@/lib/constants";
import { CTAButtons } from "@/components/ui/CTAButtons";
import { Badge } from "@/components/ui/Badge";

export function ParentHero() {
  return (
    <section className="py-10 md:py-14 lg:py-16">
      <div className="max-w-4xl">
        <Badge>SONARA Industries</Badge>
        <h1 className="hero-heading mt-5 max-w-4xl font-black text-white">
          {parentCopy.headline}
        </h1>
        <p className="mt-6 max-w-3xl text-base leading-8 text-slate-300 md:text-lg">
          {parentCopy.governance}
        </p>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400">
          Each operating company has its own users, workflows, dashboards, permissions,
          onboarding, and app surface. SONARA Industries is the ownership and governance
          layer only.
        </p>
        <CTAButtons
          primaryHref="/music"
          primaryLabel="Explore SoundOS"
          secondaryHref="/about"
          secondaryLabel="How the company is structured"
        />
      </div>
    </section>
  );
}
