import { ReadinessAppPage } from "../../../../components/ReadinessAppPage";
import { safeScaffoldCards } from "../../../../data/live-readiness";

export default function AppAdminSystemHealthPage() {
  return <ReadinessAppPage title="System health" description="Health cards are setup-gated until production monitoring, alerts, and incident ownership are configured." cards={safeScaffoldCards} />;
}
