import { PhoneChannelPlanner } from "../../../../components/phone/PhoneChannelPlanner";
import { CommunicationSafetyNotice } from "../../../../components/phone/CommunicationSafetyNotice";
import { AppDashboardShell } from "../../../../components/AppDashboardShell";

export default function AdminPhonePage() {
  return (
    <AppDashboardShell title="Phone channels">
      <PhoneChannelPlanner />
      <div className="mt-5"><CommunicationSafetyNotice /></div>
    </AppDashboardShell>
  );
}
