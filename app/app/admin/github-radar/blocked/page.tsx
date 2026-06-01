import { RepoBlocklistPanel } from "@/components/github-radar/RepoBlocklistPanel";
import { AppDashboardShell } from "@/components/AppDashboardShell";

export default function GitHubRadarBlockedPage() {
  return (
    <AppDashboardShell title="Blocked Repository Classes">
      <RepoBlocklistPanel />
    </AppDashboardShell>
  );
}
