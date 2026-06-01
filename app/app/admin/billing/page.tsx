import { ReadinessAppPage } from "../../../../components/ReadinessAppPage";
import { safeScaffoldCards } from "../../../../data/live-readiness";

export default function AppAdminBillingPage() {
  return <ReadinessAppPage title="Admin billing" description="Billing views never display secrets and do not execute refunds, payout changes, or price changes without owner approval." cards={safeScaffoldCards} />;
}
