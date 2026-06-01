import { ReadinessAppPage } from "../../../../components/ReadinessAppPage";
import { safeScaffoldCards } from "../../../../data/live-readiness";

export default function AppAdminUsersPage() {
  return <ReadinessAppPage title="Admin users" description="User management requires owner/admin role checks and audit logs." cards={safeScaffoldCards} />;
}
