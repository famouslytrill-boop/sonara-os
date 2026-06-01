import { ReadinessAppPage } from "@/components/ReadinessAppPage";

export default function AdminVoiceAgentsPage() {
  return (
    <ReadinessAppPage
      title="Admin Voice Agents"
      description="Review voice agent drafts, consent rules, provider readiness, and escalation policies before enablement."
      cards={[
        { title: "Provider review", body: "No voice provider is active without server-side env and review.", status: "Review" },
        { title: "Transcript privacy", body: "Stored transcripts must remain private tenant records.", status: "Private" },
      ]}
    />
  );
}
