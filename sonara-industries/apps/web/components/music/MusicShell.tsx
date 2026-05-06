import { DashboardShell } from "@/components/layout/DashboardShell";
import { getAuthGuardCopy } from "@/lib/auth";
import { MusicSidebar } from "./MusicSidebar";

export function MusicShell({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell sidebar={<MusicSidebar />}>
      <p className="mb-4 rounded-2xl border border-violet-300/20 bg-violet-300/10 p-3 text-sm text-violet-100">
        {getAuthGuardCopy("soundos")}
      </p>
      {children}
    </DashboardShell>
  );
}
