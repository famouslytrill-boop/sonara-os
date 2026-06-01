import { RepoRecommendationTable } from "@/components/github-radar/RepoRecommendationTable";
import { AppDashboardShell } from "@/components/AppDashboardShell";

export default function GitHubRadarRecommendationsPage() {
  return (
    <AppDashboardShell title="GitHub Radar Recommendations">
      <RepoRecommendationTable />
    </AppDashboardShell>
  );
}
