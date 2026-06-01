import { ReadinessAppPage } from "@/components/ReadinessAppPage";

export default function VoiceAgentsPage() {
  return (
    <ReadinessAppPage
      title="Voice Agents"
      description="Consent-gated voice agent planning for support, creator workflows, and business operations. Provider execution is disabled until review."
      cards={[
        { title: "Consent first", body: "No microphone request happens on page load. Users must act first.", status: "Required" },
        { title: "Human escalation", body: "Sensitive requests route to human review instead of autonomous handling.", status: "Required" },
        { title: "Provider gated", body: "Voice providers require env setup, privacy review, and safety review.", status: "Setup gated" },
      ]}
    />
  );
}
