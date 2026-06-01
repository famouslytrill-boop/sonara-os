import { ReadinessAppPage } from "../../../../../components/ReadinessAppPage";
import { safeScaffoldCards } from "../../../../../data/live-readiness";

export default function AdminCameraPermissionsPage() {
  return <ReadinessAppPage title="Camera permissions" description="Camera access requires user action, consent, and audit logging. No hidden capture is allowed." cards={safeScaffoldCards} />;
}
