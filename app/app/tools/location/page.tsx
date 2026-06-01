import { LocationPermissionPanel } from "../../../../components/device/LocationPermissionPanel";
import { HardwareSafetyNotice } from "../../../../components/device/HardwareSafetyNotice";
import { AppDashboardShell } from "../../../../components/AppDashboardShell";

export default function LocationToolPage() {
  return <AppDashboardShell title="Location tool"><HardwareSafetyNotice /><div className="mt-5"><LocationPermissionPanel /></div></AppDashboardShell>;
}
