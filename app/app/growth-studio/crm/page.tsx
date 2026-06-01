import { ReadinessAppPage } from "@/components/ReadinessAppPage";

export default function GrowthCrmPage() {
  return (
    <ReadinessAppPage
      title="Growth Studio CRM"
      description="CRM planning for leads, follow-up, customer notes, and campaign context. Outreach automation remains approval-gated."
      cards={[
        { title: "Lead records", body: "Tenant-scoped lead records and notes are planned for reviewed database flows.", status: "Planned" },
        { title: "Human follow-up", body: "No automatic outreach is sent without explicit approval and provider setup.", status: "Guarded" },
      ]}
    />
  );
}
