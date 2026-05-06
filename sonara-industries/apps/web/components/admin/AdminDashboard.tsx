import { AdminShell } from "@/components/admin/AdminShell";
import { BrandShell } from "@/components/layout/BrandShell";
import { SecurityNotice } from "@/components/ui/SecurityNotice";
import { StatCard } from "@/components/ui/StatCard";

export function AdminDashboard() {
  return (
    <BrandShell>
      <AdminShell>
        <h1 className="text-3xl font-black text-white md:text-4xl">Parent Governance Console</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
          SONARA Industries parent admin is the only cross-app governance layer for organizations,
          users, billing, audit history, app access, security events, and system health.
        </p>
        <div className="mt-6 grid-auto">
          <StatCard label="Organizations" value="0" />
          <StatCard label="Users" value="0" />
          <StatCard label="Subscriptions" value="0" />
          <StatCard label="Security Events" value="0" />
        </div>
        <section className="mt-6">
          <SecurityNotice>
            Parent admin can govern access, but customer workflows and data stay separated inside
            SONARA One, TableOps Systems, and CivicSignal Network unless explicitly authorized.
          </SecurityNotice>
        </section>
      </AdminShell>
    </BrandShell>
  );
}
