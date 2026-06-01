import { ReadinessAppPage } from "../../../../components/ReadinessAppPage";
import { safeScaffoldCards } from "../../../../data/live-readiness";

export default function VoiceSettingsPage() {
  return <ReadinessAppPage title="Voice settings" description="Voice announcements and commands are optional, muted by default, and require explicit user action." cards={safeScaffoldCards} />;
}
