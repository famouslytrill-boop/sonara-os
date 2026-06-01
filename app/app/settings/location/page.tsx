import { ReadinessAppPage } from "../../../../components/ReadinessAppPage";
import { safeScaffoldCards } from "../../../../data/live-readiness";

export default function LocationSettingsPage() {
  return <ReadinessAppPage title="Location settings" description="Location permissions are optional, user-controlled, and not used for covert tracking." cards={safeScaffoldCards} />;
}
