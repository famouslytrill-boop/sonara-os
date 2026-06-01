import { ReadinessPublicPage } from "@/components/ReadinessPublicPage";
import { githubRadarRepos, retainedResearchNames } from "@/data/github-radar-repos";

export default function GitHubRadarResearchOnlyPage() {
  const repos = [
    ...githubRadarRepos.filter((repo) => repo.integrationStatus === "reference_only").map((repo) => `${repo.name}: ${repo.licenseRisk}`),
    ...retainedResearchNames.map((name) => `${name}: retained research/reference record`),
  ];
  return (
    <ReadinessPublicPage
      eyebrow="GitHub Radar"
      title="Research-Only References"
      description="Research references are not automatically bundled, endorsed, or shipped."
      sections={[{ title: "Reference records", body: "Every integration requires review.", items: repos }]}
    />
  );
}
