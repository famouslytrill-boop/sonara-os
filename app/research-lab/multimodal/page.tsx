import type { Metadata } from "next";
import { ResearchLabAreaPage } from "../../../components/research/ResearchLabAreaPage";

export const metadata: Metadata = {
  title: "Multimodal Research",
  description: "Research-only multimodal AI notes for safe media, document, image, video, and creator workflow planning.",
};

export default function MultimodalResearchPage() {
  return (
    <ResearchLabAreaPage
      eyebrow="Multimodal Research"
      title="Review media and document intelligence before product use."
      description="Multimodal research tracks image, video, document, and long-context media systems as references. It does not ship model weights, surveillance tools, or high-stakes decision systems."
      sections={[
        {
          title: "Product fit",
          body: "Potential future fit includes Creator Studio media records, Research Lab summaries, Growth Studio content notes, and Files & Records search.",
        },
        {
          title: "Safety boundary",
          body: "No robotics control, surveillance, tactical analysis, deepfake tooling, non-consensual likeness processing, or restricted model-weight bundling.",
        },
      ]}
    />
  );
}
