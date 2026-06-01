import { PermissionCenter } from "../../../../components/permissions/PermissionCenter";
import { PermissionRiskNotice } from "../../../../components/permissions/PermissionRiskNotice";
import { AppDashboardShell } from "../../../../components/AppDashboardShell";

export default function AppPermissionSettingsPage() {
  return (
    <AppDashboardShell title="Permission Center">
      <PermissionRiskNotice />
      <div className="mt-5">
        <PermissionCenter />
      </div>
    </AppDashboardShell>
  );
}
