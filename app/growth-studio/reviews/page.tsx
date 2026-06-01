import { ReadinessPublicPage } from "../../../components/ReadinessPublicPage";

export default function GrowthReviewsPage() {
  return <ReadinessPublicPage eyebrow="Growth Studio" title="Review workflows" description="Review workflows help request, organize, and respond to real customer feedback. Fake reviews are blocked." sections={[{ title: "Trust rule", body: "No fake reviews, fake testimonials, fake logos, or undisclosed endorsements." }]} links={[{ label: "Trust", href: "/trust" }]} />;
}
