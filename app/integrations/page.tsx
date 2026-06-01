import { ReadinessPublicPage } from "../../components/ReadinessPublicPage";

export default function IntegrationsPage() {
  return (
    <ReadinessPublicPage
      eyebrow="Integrations"
      title="Safe integration map"
      description="Integrations are reference, setup-gated, or blocked until provider terms, license risk, security posture, and owner approval are reviewed."
      sections={[
        {
          title: "Provider readiness",
          body: "Stripe, Supabase, Vercel, email, SMS, AI, and storage providers require real environment variables and dashboard configuration before production use.",
        },
        {
          title: "Blocked defaults",
          body: "Scraping, unofficial messaging automation, piracy, surveillance, jailbreak tooling, and non-commercial model weights are not enabled as product integrations.",
        },
      ]}
      links={[
        { label: "Research Lab", href: "/research-lab" },
        { label: "Open Source", href: "/open-source" },
      ]}
    />
  );
}
