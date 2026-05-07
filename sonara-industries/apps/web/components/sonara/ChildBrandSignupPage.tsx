import { BrandShell } from "@/components/layout/BrandShell";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getHouseBrand, type HouseBrandKey } from "@/lib/houseBrands";

export function ChildBrandSignupPage({ brandKey }: { brandKey: HouseBrandKey }) {
  const brand = getHouseBrand(brandKey);

  return (
    <BrandShell>
      <section className="py-10 md:py-14">
        <p
          className="text-xs font-black uppercase tracking-[0.22em]"
          style={{ color: brand.accent }}
        >
          Early access
        </p>
        <h1 className="hero-heading mt-5 max-w-4xl font-black text-white">
          Start {brand.name}
        </h1>
        <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300 md:text-lg">
          {brand.name} is preparing its launch workspace for {brand.audience}.
          Paid access, production uploads, and organization data should wait
          until authentication, Supabase RLS, Stripe price IDs, and support
          routing are verified.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/support" variant={brand.buttonVariant}>
            Contact support
          </ButtonLink>
          <ButtonLink href={`${brand.route}/pricing`} variant="secondary">
            View pricing
          </ButtonLink>
          <ButtonLink href={brand.route} variant="secondary">
            Back to overview
          </ButtonLink>
        </div>
      </section>

      <section className="grid-auto">
        <Card title="Launch Gate" accent={brand.accent}>
          <p className="text-sm leading-7 text-slate-300">
            Early access is safe to browse. Paid plans and production data need
            real auth, RLS, billing, support, and QA signoff.
          </p>
        </Card>
        <Card title="Human Review" accent={brand.accent}>
          <p className="text-sm leading-7 text-slate-300">
            Risky public, billing, role, deletion, or notification actions stay
            approval-gated.
          </p>
        </Card>
      </section>
    </BrandShell>
  );
}
