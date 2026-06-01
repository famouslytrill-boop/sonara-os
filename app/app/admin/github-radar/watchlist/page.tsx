import { RepoWatchlistTable } from "@/components/github-radar/RepoWatchlistTable";
import { AppDashboardShell } from "@/components/AppDashboardShell";

export default function GitHubRadarWatchlistPage() {
  return (
    <AppDashboardShell title="GitHub Radar Watchlist">
      <RepoWatchlistTable />
    </AppDashboardShell>
  );
}
