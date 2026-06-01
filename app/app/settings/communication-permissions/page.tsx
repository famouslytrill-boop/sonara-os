import { ReadinessAppPage } from "../../../../components/ReadinessAppPage";
import { safeScaffoldCards } from "../../../../data/live-readiness";

export default function CommunicationPermissionsPage() {
  return <ReadinessAppPage title="Communication permissions" description="Email, SMS, phone, browser push, and customer outreach require opt-in settings and human approval for high-risk messages." cards={safeScaffoldCards} />;
}
