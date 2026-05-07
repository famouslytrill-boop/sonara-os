import { DivisionShell } from "@/components/layout/DivisionShell";
import { FeatureGrid } from "@/components/ui/FeatureGrid";
import { ButtonLink } from "@/components/ui/Button";
import { divisions } from "@/lib/divisions";

export default function Page() {
  return (
    <DivisionShell division="civic">
      <p className="text-sm font-black uppercase tracking-[0.22em] text-white/65">NoticeGrid</p>
      <h1 className="app-heading mt-4 max-w-3xl font-black text-white">
        Dedicated public information and local-access system.
      </h1>
      <p className="mt-5 max-w-3xl text-lg leading-8 text-white/75">
        {divisions.civic.purpose} It aggregates source-linked public information and
        is not an official government authority unless a verified public partner grants that status.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href={divisions.civic.route + "/onboarding"} variant="civic">Start onboarding</ButtonLink>
        <ButtonLink href={divisions.civic.route + "/pricing"} variant="secondary">View pricing</ButtonLink>
      </div>
      <section className="mt-10">
        <FeatureGrid features={["Public Feed", "Transit", "Alerts", "Organizations", "Broadcast", "Documents"]} />
      </section>
    </DivisionShell>
  );
}
