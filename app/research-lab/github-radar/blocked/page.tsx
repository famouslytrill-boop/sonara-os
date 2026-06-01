import { ReadinessPublicPage } from "@/components/ReadinessPublicPage";
import { githubRadarRepos } from "@/data/github-radar-repos";

export default function GitHubRadarBlockedPublicPage() {
  const blocked = githubRadarRepos.filter((repo) => repo.blocked).map((repo) => `${repo.name}: ${repo.blockedReason}`);
  return (
    <ReadinessPublicPage
      eyebrow="GitHub Radar"
      title="Blocked Classes"
      description="SONARA blocks repository classes that create legal, safety, privacy, or platform-abuse risk."
      sections={[{ title: "Blocked", body: "Blocked records are not recommendations.", items: blocked }]}
    />
  );
}
