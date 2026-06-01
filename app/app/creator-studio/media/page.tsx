import { MediaCaptureRecord } from "../../../../components/storage/MediaCaptureRecord";
import { StoragePolicyNotice } from "../../../../components/storage/StoragePolicyNotice";
import { AppDashboardShell } from "../../../../components/AppDashboardShell";

export default function CreatorMediaPage() {
  return <AppDashboardShell title="Creator media"><StoragePolicyNotice /><div className="mt-5"><MediaCaptureRecord /></div></AppDashboardShell>;
}
