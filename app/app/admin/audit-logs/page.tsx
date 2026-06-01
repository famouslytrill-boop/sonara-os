import { ReadinessAppPage } from "../../../../components/ReadinessAppPage";
import { safeScaffoldCards } from "../../../../data/live-readiness";

export default function AppAdminAuditLogsPage() {
  return <ReadinessAppPage title="Audit logs" description="Audit logs are append-only planning surfaces. Deletion of audit logs is blocked by policy." cards={safeScaffoldCards} />;
}
