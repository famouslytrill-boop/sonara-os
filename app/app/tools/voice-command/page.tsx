import { AppDashboardShell } from "../../../../components/AppDashboardShell";
import { VoiceCommandButton } from "../../../../components/voice/VoiceCommandButton";
import { VoiceSafetyNotice } from "../../../../components/voice/VoiceSafetyNotice";

export default function VoiceCommandToolPage() {
  return (
    <AppDashboardShell title="Voice command">
      <VoiceSafetyNotice />
      <div className="mt-5"><VoiceCommandButton /></div>
    </AppDashboardShell>
  );
}
