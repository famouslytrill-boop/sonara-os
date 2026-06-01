import { ReadinessAppPage } from "../../../../components/ReadinessAppPage";
import { safeScaffoldCards } from "../../../../data/live-readiness";

export default function AppAdminIntegrationsPage() {
  return <ReadinessAppPage title="Admin integrations" description="Integrations are disabled until provider env vars, terms review, and owner approval are complete." cards={safeScaffoldCards} />;
}
