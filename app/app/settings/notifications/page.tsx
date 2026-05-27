import { NotificationPreferences } from "../../../../components/preferences/NotificationPreferences";
import { AppDashboardShell } from "../../../../components/AppDashboardShell";

export default function AppNotificationSettingsPage() {
  return (
    <AppDashboardShell title="Notification Settings">
      <NotificationPreferences />
    </AppDashboardShell>
  );
}
