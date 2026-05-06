import { DashboardShell } from "@/components/layout/DashboardShell";
import { getAuthGuardCopy } from "@/lib/auth";
import { TableOpsSidebar } from "./TableOpsSidebar";

export function TableOpsShell({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell sidebar={<TableOpsSidebar />}>
      <p className="mb-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
        {getAuthGuardCopy("tableos")}
      </p>
      {children}
    </DashboardShell>
  );
}
