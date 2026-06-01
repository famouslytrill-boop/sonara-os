import { ReadinessPublicPage } from "@/components/ReadinessPublicPage";

export default function PublicGitHubRadarPage() {
  return (
    <ReadinessPublicPage
      eyebrow="Research Lab"
      title="GitHub Opportunity Radar"
      description="SONARA Research Lab tracks useful open-source and GitHub technologies, reviews license and security risk, then converts approved ideas into safe SONARA-native systems."
      sections={[
        { title: "Reference first", body: "Listing a repository does not mean SONARA owns it, bundles it, endorses it, or has integrated it." },
        { title: "Production gates", body: "Production integrations require license review, security review, privacy review, feature flags, testing, and human approval." },
      ]}
      links={[
        { label: "High-value", href: "/research-lab/github-radar/high-value" },
        { label: "Research-only", href: "/research-lab/github-radar/research-only" },
        { label: "Blocked", href: "/research-lab/github-radar/blocked" },
      ]}
    />
  );
}
