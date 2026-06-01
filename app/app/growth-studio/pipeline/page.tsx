import { ReadinessAppPage } from "@/components/ReadinessAppPage";

export default function GrowthPipelinePage() {
  return (
    <ReadinessAppPage
      title="Growth Pipeline"
      description="Pipeline planning for offers, referrals, reviews, and campaign learning without outcome guarantees."
      cards={[
        { title: "Stages", body: "Lead, qualified, offer sent, won, lost, and follow-up stages are planning defaults.", status: "Draft" },
        { title: "Safe claims", body: "The pipeline helps organize work. It does not promise customers or revenue.", status: "Honest copy" },
      ]}
    />
  );
}
