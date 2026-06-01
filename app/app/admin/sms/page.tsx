import { SMSConsentPanel } from "../../../../components/phone/SMSConsentPanel";
import { CommunicationSafetyNotice } from "../../../../components/phone/CommunicationSafetyNotice";
import { AppDashboardShell } from "../../../../components/AppDashboardShell";

export default function AdminSmsPage() {
  return (
    <AppDashboardShell title="SMS planning">
      <SMSConsentPanel />
      <div className="mt-5"><CommunicationSafetyNotice /></div>
    </AppDashboardShell>
  );
}
