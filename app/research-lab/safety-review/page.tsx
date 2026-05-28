import type { Metadata } from "next";
import { ResearchLabAreaPage } from "../../../components/research/ResearchLabAreaPage";

export const metadata: Metadata = {
  title: "Research Safety Review",
  description: "License, security, safety, commercial-use, maintenance, and product-fit review process for Research Lab candidates.",
};

export default function SafetyReviewPage() {
  return (
    <ResearchLabAreaPage
      eyebrow="Safety Review"
      title="Every external candidate must earn a safe use mode."
      description="The safety review decides whether a reference remains research-only, becomes an optional adapter, requires legal review, requires security review, or stays blocked."
      sections={[
        {
          title: "Review checks",
          body: "License, security, maintenance, commercial-use rights, privacy impact, provider terms, support burden, safety risk, and product fit.",
        },
        {
          title: "Default posture",
          body: "Unknown tools default to review-required. Risky scraping, unofficial messaging automation, red-team/jailbreak tooling, and non-commercial model weights stay blocked.",
        },
      ]}
    />
  );
}
