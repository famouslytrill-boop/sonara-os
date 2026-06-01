import { ReadinessAppPage } from "../../../../components/ReadinessAppPage";
import { safeScaffoldCards } from "../../../../data/live-readiness";

export default function BusinessSubAppsPage() {
  return <ReadinessAppPage title="Business sub-apps" description="Sub-apps are metadata-driven app records, not arbitrary user-created physical databases." cards={safeScaffoldCards} />;
}
