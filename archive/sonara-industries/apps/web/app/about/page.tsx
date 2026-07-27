import { BrandShell } from "@/components/layout/BrandShell";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { parentCopy } from "@/lib/constants";

export default function Page() {
  return (
    <BrandShell>
      <SectionHeader
        eyebrow="Parent company"
        title="SONARA Industries is the governance layer."
        body={parentCopy.governance}
      />
      <div className="mt-6 grid-auto">
        <Card title="What is shared" accent="#22d3ee">
          <p className="text-sm leading-6 text-slate-300">
            Parent ownership, billing spine, security spine, infrastructure spine, audit logging,
            and governance policy.
          </p>
        </Card>
        <Card title="What stays separate" accent="#a78bfa">
          <p className="text-sm leading-6 text-slate-300">
            Customer data, onboarding, dashboards, permissions, analytics, workflows, product
            pricing, and app-specific workspace access.
          </p>
        </Card>
        <Card title="Why it matters" accent="#34d399">
          <p className="text-sm leading-6 text-slate-300">
            Each operating company serves a different market, so the user experience and data
            boundaries stay intentionally separate.
          </p>
        </Card>
      </div>
    </BrandShell>
  );
}
