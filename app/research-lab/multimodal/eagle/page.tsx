import { ReadinessPublicPage } from "../../../../components/ReadinessPublicPage";

export default function EagleResearchPage() {
  return (
    <ReadinessPublicPage
      eyebrow="Multimodal research"
      title="NVlabs Eagle / embodied research reference"
      description="This is a research/reference note only. SONARA does not bundle model weights, claim partnership, or expose robotics-control, surveillance, tactical, or high-stakes decision features."
      sections={[
        {
          title: "Allowed research use",
          body: "Study multimodal architecture patterns for media, document, image, and long-context reasoning workflows.",
        },
        {
          title: "Blocked use",
          body: "No robotics control outputs, surveillance, people tracking, biometric identification, tactical analysis, or commercial model-weight use without legal approval.",
        },
      ]}
      links={[
        { label: "Open-source watchlist", href: "/research-lab/open-source" },
        { label: "Safety review", href: "/research-lab/safety-review" },
      ]}
    />
  );
}
