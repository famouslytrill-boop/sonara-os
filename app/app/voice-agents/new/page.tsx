import { ReadinessAppPage } from "@/components/ReadinessAppPage";

export default function NewVoiceAgentPage() {
  return (
    <ReadinessAppPage
      title="New Voice Agent"
      description="Create a voice agent draft for review. Publishing, calls, and provider connections are disabled until approved."
      cards={[
        { title: "Draft only", body: "Agent behavior is stored as planning metadata before any runtime execution.", status: "Draft" },
        { title: "Blocked actions", body: "No automated calls without consent, impersonation, emergency claims, or automatic outreach.", status: "Blocked" },
      ]}
    />
  );
}
