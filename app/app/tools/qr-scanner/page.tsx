import { QRCodeScannerPanel } from "../../../../components/camera/QRCodeScannerPanel";
import { CameraSafetyNotice } from "../../../../components/camera/CameraSafetyNotice";
import { AppDashboardShell } from "../../../../components/AppDashboardShell";

export default function QRScannerToolPage() {
  return (
    <AppDashboardShell title="QR scanner">
      <CameraSafetyNotice />
      <div className="mt-5"><QRCodeScannerPanel /></div>
    </AppDashboardShell>
  );
}
