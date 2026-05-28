import type { Metadata } from "next";
import { ResearchLabAreaPage } from "../../../components/research/ResearchLabAreaPage";

export const metadata: Metadata = {
  title: "Creator Tools Research",
  description: "Research-only creator tool references for safe Creator Studio planning.",
};

export default function CreatorToolsResearchPage() {
  return (
    <ResearchLabAreaPage
      eyebrow="Creator Tool Library"
      title="Track creative tools without implying native ownership."
      description="Creator tool references help SONARA document animation, design, video, audio, collaboration, and asset workflows before deciding whether anything belongs in Creator Studio."
      sections={[
        {
          title: "Reference-first workflow",
          body: "OpenToonz, long-video research, design tools, and collaboration platforms are external references unless a reviewed adapter exists.",
        },
        {
          title: "Rights and disclosure",
          body: "No workflow may imply automatic rights clearance, native hosting, endorsement, or commercial safety. Users remain responsible for licenses and source material.",
        },
      ]}
    />
  );
}
