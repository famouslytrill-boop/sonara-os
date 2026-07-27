import { calculateFounderKpis } from "../../lib/sonara/analytics/kpiEngine";
import { AutonomyStatusCard } from "./AutonomyStatusCard";
import { FounderKpiCard } from "./FounderKpiCard";
import { PasskeyReadinessCard } from "./PasskeyReadinessCard";
import { SoundDiscoveryCard } from "./SoundDiscoveryCard";
import { StoreProductReadinessCard } from "./StoreProductReadinessCard";
import { VaultStackCard } from "./VaultStackCard";

export function FounderCommandCenter() {
  const summary = calculateFounderKpis();

  return (
    <div className="grid gap-6">
      <FounderKpiCard summary={summary} />
      <div className="rounded-lg border border-[#F59E0B] bg-[#211B2D] p-4 text-sm leading-6 text-[#F9FAFB]">
        Founder route must be protected by auth/role checks before exposing real business metrics or operational controls.
      </div>
      <AutonomyStatusCard />
      <div className="grid gap-4 lg:grid-cols-2">
        <StoreProductReadinessCard />
        <SoundDiscoveryCard />
        <VaultStackCard />
        <PasskeyReadinessCard />
      </div>
    </div>
  );
}
