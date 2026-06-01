import { CreatorToolCard } from "../../../../components/creator/CreatorToolCard";
import { ReadinessPublicPage } from "../../../../components/ReadinessPublicPage";
import { getCreatorToolsByCategory } from "../../../../data/creator-tools";

export default function CreatorVoiceToolsPage() {
  const tools = getCreatorToolsByCategory("voice");

  return (
    <ReadinessPublicPage
      eyebrow="Creator tools"
      title="Voice workflow references"
      description="Voice tooling is research-only unless consent, rights, provider configuration, and owner approval are complete."
      sections={[
        {
          title: "Voice safety",
          body: "No impersonation, celebrity cloning, deceptive voice content, or public publishing without explicit consent and review.",
        },
        {
          title: "References",
          body: "Current voice references are external research notes, not hosted SONARA tools.",
          items: tools.map((tool) => `${tool.name}: ${tool.status}`),
        },
      ]}
      links={[{ label: "Creator tools", href: "/creator-studio/tools" }]}
    />
  );
}
