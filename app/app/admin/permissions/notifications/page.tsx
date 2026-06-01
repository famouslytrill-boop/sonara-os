import { ReadinessAppPage } from "../../../../../components/ReadinessAppPage";
import { safeScaffoldCards } from "../../../../../data/live-readiness";

export default function AdminNotificationPermissionsPage() {
  return <ReadinessAppPage title="Notification permissions" description="Notifications must be opt-in, revocable, and visible. No hidden alerts." cards={safeScaffoldCards} />;
}
