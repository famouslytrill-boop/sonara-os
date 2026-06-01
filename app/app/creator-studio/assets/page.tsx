import { AssetVaultCard } from "../../../../components/storage/AssetVaultCard";
import { RightsReviewNotice } from "../../../../components/storage/RightsReviewNotice";
import { AppDashboardShell } from "../../../../components/AppDashboardShell";

export default function CreatorAssetsPage() {
  return <AppDashboardShell title="Creator assets"><RightsReviewNotice /><div className="mt-5"><AssetVaultCard /></div></AppDashboardShell>;
}
