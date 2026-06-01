import { ReadinessAppPage } from "../../../../components/ReadinessAppPage";
import { safeScaffoldCards } from "../../../../data/live-readiness";

export default function OwnerRevenueReadinessPage() {
  return <ReadinessAppPage title="Revenue readiness" description="Revenue systems require Stripe products, webhook verification, refund controls, pricing review, and support ownership." cards={safeScaffoldCards} />;
}
