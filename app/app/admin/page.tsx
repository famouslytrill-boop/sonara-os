import { ReadinessAppPage } from "../../../components/ReadinessAppPage";
import { safeScaffoldCards } from "../../../data/live-readiness";

export default function AppAdminPage() {
  return <ReadinessAppPage title="Admin dashboard" description="Admin surfaces are locked placeholders until owner/admin auth and role checks are connected." cards={safeScaffoldCards} />;
}
