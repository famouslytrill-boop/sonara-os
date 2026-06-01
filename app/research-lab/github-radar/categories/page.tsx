import { ReadinessPublicPage } from "@/components/ReadinessPublicPage";
import { githubRadarCategories } from "@/lib/github-intelligence/repo-categories";

export default function GitHubRadarCategoriesPage() {
  return (
    <ReadinessPublicPage
      eyebrow="GitHub Radar"
      title="Technology Categories"
      description="Categories map repository opportunities to SONARA products and shared infrastructure."
      sections={[{ title: "Tracked categories", body: "These categories guide research and review.", items: githubRadarCategories }]}
    />
  );
}
