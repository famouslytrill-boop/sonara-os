import { ReadinessAppPage } from "../../../../../../components/ReadinessAppPage";
import { safeScaffoldCards } from "../../../../../../data/live-readiness";

export default function BusinessSubAppSettingsPage() {
  return <ReadinessAppPage title="Sub-app settings" description="Settings changes require organization membership, role checks, and audit events before production activation." cards={safeScaffoldCards} />;
}
