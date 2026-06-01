import { ReadinessAppPage } from "../../../../components/ReadinessAppPage";
import { safeScaffoldCards } from "../../../../data/live-readiness";

export default function OwnerCommandCenterPage() {
  return <ReadinessAppPage title="Owner command center" description="Owner review queues, revenue readiness, security review, and launch controls require owner-only auth and audit logs." cards={safeScaffoldCards} />;
}
