import { BarChart3 } from "lucide-react";
import type { FounderKpiSummary } from "../../lib/sonara/analytics/kpiTypes";

export function FounderKpiCard({ summary }: { summary: FounderKpiSummary }) {
  const metrics = [
    ["Launch", summary.launchReadinessScore],
    ["Product", summary.productReadinessScore],
    ["Company", summary.companyReadinessScore],
    ["Marketing", summary.marketingReadinessScore],
    ["Profit", summary.profitReadinessScore],
    ["Autonomy", summary.safeAutonomyReadiness],
    ["Open Source", summary.openSourceStackReadiness],
    ["Writing", summary.writingEngineReadiness],
    ["Moat", summary.moatStrength],
  ] as const;

  return (
    <section className="rounded-lg border border-[#332A40] bg-[#191522] p-5 text-[#F9FAFB]">
      <div className="flex items-center gap-3">
        <BarChart3 className="text-[#2DD4BF]" size={24} />
        <div>
          <p className="text-xs font-black uppercase text-[#FFB454]">Founder Command Center</p>
          <h1 className="text-3xl font-black">IPO-grade discipline roadmap.</h1>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-[#332A40] bg-[#121018] p-4">
            <p className="text-xs font-bold uppercase text-[#8F879C]">{label}</p>
            <p className="mt-1 text-3xl font-black text-[#F9FAFB]">{value}/100</p>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Status label="Stripe" value={summary.stripeReadiness} />
        <Status label="Supabase" value={summary.supabaseReadiness} />
        <Status label="Vector Memory" value={summary.vectorMemoryReadiness} />
        <Status label="Sound Discovery" value={summary.soundDiscoveryReadiness} />
        <Status label="Passkeys" value={summary.passkeyReadiness} />
        <Status label="Google Play" value={summary.googlePlayReadiness} />
      </div>
      <div className="mt-5 rounded-lg border border-[#332A40] bg-[#121018] p-4">
        <p className="text-sm font-black">Next 5 actions</p>
        <ul className="mt-2 grid gap-2 text-sm leading-6 text-[#C4BFD0]">
          {summary.nextActions.slice(0, 5).map((action) => (
            <li key={action}>- {action}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Status({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#332A40] bg-[#121018] p-3">
      <p className="text-xs font-bold uppercase text-[#8F879C]">{label}</p>
      <p className="mt-1 text-sm font-black capitalize text-[#F9FAFB]">{value.replaceAll("_", " ")}</p>
    </div>
  );
}
