import { buildReleaseStrategy } from "../../lib/sonara/release/releaseStrategyEngine";
import type { ReleaseStrategyPlan } from "../../lib/sonara/release/releaseStrategyTypes";

export function ReleaseStrategyCard({ plan = buildReleaseStrategy({ title: "SONARA Demo Release" }) }: { plan?: ReleaseStrategyPlan }) {
  return (
    <section className="rounded-lg border border-[#332A40] bg-[#191522] p-4 text-[#F9FAFB]">
      <p className="text-xs font-black uppercase text-[#2DD4BF]">Release Strategy</p>
      <h3 className="mt-2 text-xl font-black">Distribution-ready export planning</h3>
      <p className="mt-2 text-sm leading-6 text-[#C4BFD0]">{plan.positioning}</p>
      <ul className="mt-3 grid gap-1 text-sm leading-6 text-[#C4BFD0]">
        {plan.rolloutSteps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ul>
    </section>
  );
}
