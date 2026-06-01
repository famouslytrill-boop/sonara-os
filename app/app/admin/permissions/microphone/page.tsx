import { ReadinessAppPage } from "../../../../../components/ReadinessAppPage";
import { safeScaffoldCards } from "../../../../../data/live-readiness";

export default function AdminMicrophonePermissionsPage() {
  return <ReadinessAppPage title="Microphone permissions" description="Microphone access is setup-gated and must show visible listening state." cards={safeScaffoldCards} />;
}
