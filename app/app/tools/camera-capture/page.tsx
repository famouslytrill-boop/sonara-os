import { CameraPermissionPanel } from "../../../../components/camera/CameraPermissionPanel";
import { ImageCapturePanel } from "../../../../components/camera/ImageCapturePanel";
import { AppDashboardShell } from "../../../../components/AppDashboardShell";

export default function CameraCaptureToolPage() {
  return (
    <AppDashboardShell title="Camera capture">
      <CameraPermissionPanel />
      <div className="mt-5"><ImageCapturePanel /></div>
    </AppDashboardShell>
  );
}
