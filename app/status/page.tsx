import { ReadinessPublicPage } from "../../components/ReadinessPublicPage";
import { publicSafetySections } from "../../data/live-readiness";

export default function StatusPage() {
  return (
    <ReadinessPublicPage
      eyebrow="Status"
      title="SONARA live-readiness status"
      description="Operational status is setup-gated until monitoring, support ownership, incident routing, and production provider checks are configured."
      sections={[
        ...publicSafetySections,
        {
          title: "Current posture",
          body: "Public routes build, support intake is validated, and provider-dependent systems remain clearly marked as setup-required.",
          items: ["Vercel deployment requires PR checks", "Supabase Preview requires secrets", "Support inbox ownership requires human confirmation"],
        },
      ]}
      links={[
        { label: "Support", href: "/support" },
        { label: "Trust", href: "/trust" },
        { label: "Launch docs", href: "/docs" },
      ]}
    />
  );
}
