import type { Metadata } from "next";
import { ResearchLabAreaPage } from "../../../components/research/ResearchLabAreaPage";

export const metadata: Metadata = {
  title: "Growth Intelligence Research",
  description: "Ethical growth intelligence research for non-manipulative recommendations and campaign planning.",
};

export default function GrowthIntelligenceResearchPage() {
  return (
    <ResearchLabAreaPage
      eyebrow="Growth Intelligence"
      title="Study growth patterns without building manipulation systems."
      description="Growth intelligence research turns public patterns into explainable planning notes, recommendation transparency, and ethical next-best-action ideas."
      sections={[
        {
          title: "Allowed research",
          body: "Content quality, audience fit, timing observations, format comparison, campaign learning notes, and owner-reviewed follow-up planning.",
        },
        {
          title: "Blocked behavior",
          body: "Spam automation, engagement bait, botting, fake accounts, fake scarcity, scraping private data, platform-rule bypass, and misinformation amplification.",
        },
      ]}
    />
  );
}
