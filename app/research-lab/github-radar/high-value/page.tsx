import { ReadinessPublicPage } from "@/components/ReadinessPublicPage";
import { githubRadarRepos } from "@/data/github-radar-repos";

export default function GitHubRadarHighValuePage() {
  const repos = githubRadarRepos.filter((repo) => !repo.blocked && repo.score >= 75).map((repo) => `${repo.name}: ${repo.recommendedAction}`);
  return (
    <ReadinessPublicPage
      eyebrow="GitHub Radar"
      title="High-Value Review Queue"
      description="High-value records are candidates for review, not shipped integrations."
      sections={[{ title: "Candidates", body: "These records need review before implementation.", items: repos }]}
    />
  );
}
