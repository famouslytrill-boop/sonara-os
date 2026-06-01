import { RepoReviewPanel } from "@/components/github-radar/RepoReviewPanel";
import { AppDashboardShell } from "@/components/AppDashboardShell";

export default function GitHubRadarReviewsPage() {
  return (
    <AppDashboardShell title="GitHub Radar Reviews">
      <RepoReviewPanel />
    </AppDashboardShell>
  );
}
