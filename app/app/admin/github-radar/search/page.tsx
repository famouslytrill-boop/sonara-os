import { ReadinessAppPage } from "@/components/ReadinessAppPage";

export default function GitHubRadarSearchPage() {
  return (
    <ReadinessAppPage
      title="GitHub Radar Search"
      description="Search import is manual unless a server-side GitHub token and rate-limit policy are configured."
      cards={[
        { title: "Manual URL intake", body: "Owners can paste repo URLs for review without API sync.", status: "Available" },
        { title: "Token sync", body: "GitHub token is optional, server-only, and never logged.", status: "Setup gated" },
      ]}
    />
  );
}
