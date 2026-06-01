import { ReadinessAppPage } from "../../../../components/ReadinessAppPage";
import { safeScaffoldCards } from "../../../../data/live-readiness";

export default function AppAdminResearchPage() {
  return <ReadinessAppPage title="Admin research" description="Research intake decisions require license, security, safety, maintenance, commercial-use, and product-fit review." cards={safeScaffoldCards} />;
}
