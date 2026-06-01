import { ReadinessAppPage } from "../../../../../components/ReadinessAppPage";
import { safeScaffoldCards } from "../../../../../data/live-readiness";

export default function NewBusinessSubAppPage() {
  return <ReadinessAppPage title="New business sub-app" description="Sub-app creation is setup-gated and must use safe templates, tenant scoping, and audit events." cards={safeScaffoldCards} />;
}
