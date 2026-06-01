import { ReadinessAppPage } from "../../../../../components/ReadinessAppPage";
import { safeScaffoldCards } from "../../../../../data/live-readiness";

export default function NewBusinessWorkspacePage() {
  return <ReadinessAppPage title="New business workspace" description="Create-workspace flow placeholder. Actual creation requires authenticated organization context and audit logging." cards={safeScaffoldCards} />;
}
