import { buildEmergingCreatorPlan } from "../../lib/sonara/creator/emergingCreatorEngine";

export function EmergingCreatorCard() {
  const plan = buildEmergingCreatorPlan();
  return (
    <section className="rounded-lg border border-[#332A40] bg-[#191522] p-4 text-[#F9FAFB]">
      <p className="text-xs font-black uppercase text-[#FFB454]">Emerging Creator Lane</p>
      <h3 className="mt-2 text-xl font-black">{plan.lane}</h3>
      <ul className="mt-3 grid gap-1 text-sm leading-6 text-[#C4BFD0]">
        {plan.firstActions.map((action) => (
          <li key={action}>{action}</li>
        ))}
      </ul>
    </section>
  );
}
