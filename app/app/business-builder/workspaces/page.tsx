import { ReadinessAppPage } from "../../../../components/ReadinessAppPage";
import { safeScaffoldCards } from "../../../../data/live-readiness";

export default function BusinessWorkspacesPage() {
  return <ReadinessAppPage title="Business workspaces" description="Workspace records are tenant-scoped and setup-gated until auth, organization memberships, and RLS are verified." cards={safeScaffoldCards} />;
}
