import { ReadinessAppPage } from "../../../../../components/ReadinessAppPage";
import { safeScaffoldCards } from "../../../../../data/live-readiness";

export default function AdminPhonePermissionsPage() {
  return <ReadinessAppPage title="Phone permissions" description="Phone and SMS remain planning-only until provider setup and consent records are complete." cards={safeScaffoldCards} />;
}
