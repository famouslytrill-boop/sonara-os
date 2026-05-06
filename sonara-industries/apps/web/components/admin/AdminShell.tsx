import { DashboardShell } from "@/components/layout/DashboardShell";
import { getAuthGuardCopy } from "@/lib/auth";
import { AdminSidebar } from "./AdminSidebar";

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell sidebar={<AdminSidebar />}>
      <p className="mb-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-sm text-cyan-100">
        {getAuthGuardCopy("parent_admin")} Parent admin is the only cross-app governance layer.
      </p>
      {children}
    </DashboardShell>
  );
}
