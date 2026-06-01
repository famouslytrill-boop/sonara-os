import { ReadinessAppPage } from "../../../../../components/ReadinessAppPage";
import { safeScaffoldCards } from "../../../../../data/live-readiness";

export default function AdminVoicePermissionsPage() {
  return <ReadinessAppPage title="Voice permissions" description="Voice commands are draft-only. High-risk commands require owner approval." cards={safeScaffoldCards} />;
}
