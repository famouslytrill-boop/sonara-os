import { ReadinessPublicPage } from "../../../components/ReadinessPublicPage";

export default function GrowthContentPlannerPage() {
  return <ReadinessPublicPage eyebrow="Growth Studio" title="Content planner" description="Content planning helps organize drafts, formats, timing, and campaigns without promising reach or revenue." sections={[{ title: "Decision support only", body: "Recommendations are explainable planning notes, not autonomous posting systems." }]} links={[{ label: "Recommendation research", href: "/growth-studio/recommendation-research" }]} />;
}
