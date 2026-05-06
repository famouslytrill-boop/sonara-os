import { DashboardShell } from "@/components/layout/DashboardShell";
import { getAuthGuardCopy } from "@/lib/auth";
import { CivicSidebar } from "./CivicSidebar";

export function CivicShell({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell sidebar={<CivicSidebar />}>
      <p className="mb-4 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm text-emerald-100">
        {getAuthGuardCopy("civic_signal")}
      </p>
      {children}
    </DashboardShell>
  );
}
