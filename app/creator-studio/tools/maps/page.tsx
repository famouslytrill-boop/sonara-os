import { ReadinessPublicPage } from "../../../../components/ReadinessPublicPage";
import { getCreatorToolsByCategory } from "../../../../data/creator-tools";

export default function CreatorMapToolsPage() {
  const tools = getCreatorToolsByCategory("maps");

  return (
    <ReadinessPublicPage
      eyebrow="Creator tools"
      title="Map and motion visual references"
      description="Map and motion references are for creator planning, campaign drafts, and service-area visuals. They are not surveillance or certified navigation systems."
      sections={[
        {
          title: "Allowed planning",
          body: "Use map visuals for service-area previews, venue/event planning, campaign explainers, and creator education.",
        },
        {
          title: "References",
          body: "External map/video libraries require license, security, and implementation review before product use.",
          items: tools.map((tool) => `${tool.name}: ${tool.status}`),
        },
      ]}
      links={[{ label: "Creator tools", href: "/creator-studio/tools" }]}
    />
  );
}
