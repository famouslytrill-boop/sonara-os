import { AdminShell } from "@/components/admin/AdminShell";
import { BrandShell } from "@/components/layout/BrandShell";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export function AdminModulePage({
  title,
  description,
  modules,
}: {
  title: string;
  description: string;
  modules: string[];
}) {
  return (
    <BrandShell>
      <AdminShell>
        <h1 className="text-3xl font-black text-white md:text-4xl">{title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">{description}</p>
        <div className="mt-6 grid-auto">
          {modules.map((module) => (
            <Card key={module} title={module} accent="#22d3ee">
              <p className="text-sm leading-6 text-slate-300">
                Parent admin module under development. This page is wired for governance routing
                and does not mix customer app dashboards.
              </p>
            </Card>
          ))}
        </div>
        <div className="mt-5">
          <EmptyState
            title="Governance-only surface"
            body="Parent admin is not a shared product dashboard. It is for access, billing, audit, security, and operational governance."
            actionLabel="Back to admin dashboard"
            actionHref="/admin/dashboard"
          />
        </div>
      </AdminShell>
    </BrandShell>
  );
}
