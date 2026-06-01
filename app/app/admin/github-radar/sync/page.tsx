import { GitHubSyncStatus } from "@/components/github-radar/GitHubSyncStatus";
import { AppDashboardShell } from "@/components/AppDashboardShell";

export default function GitHubRadarSyncPage() {
  return (
    <AppDashboardShell title="GitHub Radar Sync">
      <GitHubSyncStatus />
    </AppDashboardShell>
  );
}
