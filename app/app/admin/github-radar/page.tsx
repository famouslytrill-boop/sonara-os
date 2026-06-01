import { GitHubRadarDashboard } from "@/components/github-radar/GitHubRadarDashboard";
import { GitHubSyncStatus } from "@/components/github-radar/GitHubSyncStatus";
import { RepoApprovalGate } from "@/components/github-radar/RepoApprovalGate";
import { AppDashboardShell } from "@/components/AppDashboardShell";

export default function AdminGitHubRadarPage() {
  return (
    <AppDashboardShell title="GitHub Opportunity Radar">
      <GitHubSyncStatus />
      <div className="mt-4">
        <RepoApprovalGate />
      </div>
      <div className="mt-5">
        <GitHubRadarDashboard />
      </div>
    </AppDashboardShell>
  );
}
