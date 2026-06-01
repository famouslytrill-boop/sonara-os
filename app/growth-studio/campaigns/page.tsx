import { ReadinessPublicPage } from "../../../components/ReadinessPublicPage";

export default function GrowthCampaignsPage() {
  return <ReadinessPublicPage eyebrow="Growth Studio" title="Campaign planning" description="Campaigns are draft-first planning workflows. SONARA does not auto-send customer outreach or guarantee growth." sections={[{ title: "Safety", body: "No spam automation, fake urgency, fake scarcity, unauthorized scraping, or posting without approval." }]} links={[{ label: "Growth Studio", href: "/growth-studio" }]} />;
}
