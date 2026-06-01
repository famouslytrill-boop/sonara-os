import { ReadinessPublicPage } from "../../../components/ReadinessPublicPage";

export default function GrowthOffersPage() {
  return <ReadinessPublicPage eyebrow="Growth Studio" title="Offer planning" description="Offer planning helps users structure packages, terms, and follow-up. It does not promise revenue." sections={[{ title: "Review required", body: "Pricing, discount, and customer-facing copy should be reviewed before publishing." }]} links={[{ label: "Pricing", href: "/pricing" }]} />;
}
