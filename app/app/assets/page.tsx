import { AssetVaultCard } from "../../../components/storage/AssetVaultCard";
import { StoragePolicyNotice } from "../../../components/storage/StoragePolicyNotice";
import { AppDashboardShell } from "../../../components/AppDashboardShell";

export default function AssetsPage() {
  return <AppDashboardShell title="Assets"><StoragePolicyNotice /><div className="mt-5"><AssetVaultCard /></div></AppDashboardShell>;
}
