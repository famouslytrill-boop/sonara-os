import { CivicShell } from "@/components/civic/CivicShell";
import { StatCard } from "@/components/ui/StatCard";
import { FeedPanel } from "./FeedPanel";
import { TransitPanel } from "./TransitPanel";
import { AlertsPanel } from "./AlertsPanel";
import { OrganizationProfiles } from "./OrganizationProfilePanel";
import { BroadcastPanel } from "./BroadcastPanel";
import { ApprovalQueuePanel } from "./ApprovalQueuePanel";

export function CivicDashboard() {
  return (
    <CivicShell>
      <div className="grid-auto">
        <StatCard label="Local Feed" value="86" />
        <StatCard label="Transit Notices" value="7" />
        <StatCard label="Public Meetings" value="14" />
        <StatCard label="Organization Posts" value="33" />
      </div>
      <div className="mt-5 grid-auto">
        <FeedPanel />
        <TransitPanel />
        <AlertsPanel />
        <OrganizationProfiles />
        <BroadcastPanel />
        <ApprovalQueuePanel />
      </div>
    </CivicShell>
  );
}
