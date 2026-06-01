import { ReadinessPublicPage } from "../../../components/ReadinessPublicPage";

export default function GrowthReferralsPage() {
  return <ReadinessPublicPage eyebrow="Growth Studio" title="Referral planning" description="Referral systems require clear terms, consent, and no deceptive incentives." sections={[{ title: "Consent", body: "Customer messaging and referral outreach require opt-in and approval." }]} links={[{ label: "Legal", href: "/legal" }]} />;
}
