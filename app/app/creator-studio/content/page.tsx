import { ReadinessAppPage } from "@/components/ReadinessAppPage";

export default function CreatorContentPage() {
  return (
    <ReadinessAppPage
      title="Creator Content"
      description="Plan releases, assets, rights notes, and publishing checklists. Publishing remains human-approved."
      cards={[
        { title: "Rights review", body: "Assets and generated media require rights review before publishing.", status: "Required" },
        { title: "No automatic publishing", body: "External social and media integrations are placeholders unless configured.", status: "Guarded" },
      ]}
    />
  );
}
