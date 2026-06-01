import { ReadinessPublicPage } from "../../../components/ReadinessPublicPage";

export default function GrowthSocialPage() {
  return <ReadinessPublicPage eyebrow="Growth Studio" title="Social planning" description="Social workflows are planning surfaces. External social integrations are placeholders unless configured and reviewed." sections={[{ title: "Blocked behavior", body: "No platform manipulation, botting, fake accounts, spam posting, or scraping private user data." }]} links={[{ label: "Research Lab", href: "/research-lab" }]} />;
}
