import { QRCodeGeneratorCard } from "../../../components/qr/QRCodeGeneratorCard";
import { AppDashboardShell } from "../../../components/AppDashboardShell";

export default function QRCodesPage() {
  return <AppDashboardShell title="QR codes"><QRCodeGeneratorCard /></AppDashboardShell>;
}
