import { CivicShell } from "@/components/civic/CivicShell";
import { MusicShell } from "@/components/music/MusicShell";
import { TableOpsShell } from "@/components/tableops/TableOpsShell";
import { DivisionShell } from "@/components/layout/DivisionShell";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { divisions, type DivisionKey } from "@/lib/divisions";

type ModulePageProps = {
  division: DivisionKey;
  title: string;
  description: string;
  features?: string[];
};

function AppScopedContent({ division, title, description, features = [] }: ModulePageProps) {
  const app = divisions[division];
  return (
    <>
      <header className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-white/55">
          {app.name} / separate app surface
        </p>
        <h1 className="mt-3 max-w-3xl text-3xl font-black text-white md:text-4xl">{title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">{description}</p>
      </header>
      <div className="grid-auto">
        {features.map((feature) => (
          <Card key={feature} accent={app.accent} title={feature}>
            <p className="text-sm leading-6 text-slate-300">
              Module under development. This page is wired so navigation does not break.
            </p>
          </Card>
        ))}
      </div>
      <div className="mt-5">
        <EmptyState
          title="Independent workspace boundary"
          body={`${app.name} keeps its own users, organization selection, onboarding, permissions, dashboards, and product data. Parent admin governance is the only cross-app layer.`}
          actionLabel="Open dashboard"
          actionHref={`${app.route}/dashboard`}
        />
      </div>
    </>
  );
}

export function AppModulePage(props: ModulePageProps) {
  const content = <AppScopedContent {...props} />;
  const shell =
    props.division === "music" ? (
      <MusicShell>{content}</MusicShell>
    ) : props.division === "tableops" ? (
      <TableOpsShell>{content}</TableOpsShell>
    ) : (
      <CivicShell>{content}</CivicShell>
    );

  return <DivisionShell division={props.division}>{shell}</DivisionShell>;
}
