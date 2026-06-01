import { githubRadarRepos } from "@/data/github-radar-repos";
import { RepoOpportunityCard } from "./RepoOpportunityCard";

export function GitHubRadarDashboard() {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      {githubRadarRepos.slice(0, 6).map((repo) => (
        <RepoOpportunityCard key={repo.repoUrl} repo={repo} />
      ))}
    </section>
  );
}
