import { ReadinessPublicPage } from "../../components/ReadinessPublicPage";

export default function ChangelogPage() {
  return (
    <ReadinessPublicPage
      eyebrow="Changelog"
      title="Launch-readiness changelog"
      description="A public changelog surface for platform readiness notes. Production release notes require final PR review and deployment approval."
      sections={[
        {
          title: "Recent focus",
          body: "CI consistency, Supabase migration repair, public support routes, Research Lab governance, pricing clarity, and safety gates.",
        },
        {
          title: "Release rule",
          body: "Do not mark provider-backed systems as live until credentials, webhooks, DNS/email, and dashboard checks are verified by a human owner.",
        },
      ]}
      links={[
        { label: "Final report", href: "/docs" },
        { label: "Support", href: "/support" },
      ]}
    />
  );
}
