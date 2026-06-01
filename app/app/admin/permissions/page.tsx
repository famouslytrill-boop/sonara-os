import { ReadinessAppPage } from "../../../../components/ReadinessAppPage";
import { safeScaffoldCards } from "../../../../data/live-readiness";

export default function AdminPermissionsPage() {
  return <ReadinessAppPage title="Admin permissions" description="Admin permission views are locked placeholders until owner/admin role checks are connected." cards={safeScaffoldCards} />;
}
