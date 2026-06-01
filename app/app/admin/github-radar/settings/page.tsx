import { ReadinessAppPage } from "@/components/ReadinessAppPage";

export default function GitHubRadarSettingsPage() {
  return (
    <ReadinessAppPage
      title="GitHub Radar Settings"
      description="Configure manual mode, optional sync, public research visibility, and auto-install blocking."
      cards={[
        { title: "Auto-install blocked", body: "The radar cannot install dependencies or copy repository code.", status: "Blocked" },
        { title: "Admin review required", body: "Owner/admin approval is required before any integration moves beyond research.", status: "Required" },
      ]}
    />
  );
}
