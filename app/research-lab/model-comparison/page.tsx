import type { Metadata } from "next";
import { ResearchLabAreaPage } from "../../../components/research/ResearchLabAreaPage";

export const metadata: Metadata = {
  title: "Model Comparison Lab",
  description: "Research-only model comparison planning for safe provider evaluation.",
};

export default function ModelComparisonResearchPage() {
  return (
    <ResearchLabAreaPage
      eyebrow="Model Comparison Lab"
      title="Compare model behavior before enabling provider workflows."
      description="Model Comparison Lab is a research surface for prompt tests, scoring rubrics, safety notes, and provider-fit reports. It makes no live provider calls unless approved server-side configuration exists."
      sections={[
        {
          title: "Evaluation focus",
          body: "Compare quality, latency, cost, privacy posture, refusal behavior, hallucination risk, and fit for Business Builder, Creator Studio, and Growth Studio workflows.",
        },
        {
          title: "Safety boundary",
          body: "Jailbreak presets, harmful prompt libraries, hidden telemetry, and provider-key exposure are blocked. High-risk runs require owner approval.",
        },
      ]}
    />
  );
}
