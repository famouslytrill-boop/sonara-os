import type { ArrangementCoreGuidance } from "../../lib/sonara/arrangement/arrangementCoreTypes";
import { buildArrangementCore } from "../../lib/sonara/arrangement/arrangementCoreEngine";

export function ArrangementCoreCard({ guidance = buildArrangementCore() }: { guidance?: ArrangementCoreGuidance }) {
  return (
    <section className="rounded-lg border border-[#332A40] bg-[#191522] p-4 text-[#F9FAFB]">
      <p className="text-xs font-black uppercase text-[#FFB454]">Arrangement Core</p>
      <h3 className="mt-2 text-xl font-black">Idea to arrangement guidance</h3>
      <div className="mt-4 grid gap-3">
        <p className="rounded-lg border border-[#332A40] bg-[#121018] p-3 text-sm leading-6 text-[#C4BFD0]">{guidance.introStrategy}</p>
        <div className="grid gap-3 md:grid-cols-2">
          <List title="Hook" items={[guidance.hookStrategy, ...guidance.vocalPlacement]} />
          <List title="Energy" items={guidance.energyCurve} />
          <List title="Drums" items={guidance.drumMovement} />
          <List title="Risks" items={guidance.arrangementRisks} />
        </div>
      </div>
    </section>
  );
}

function List({ items, title }: { items: string[]; title: string }) {
  return (
    <div className="rounded-lg border border-[#332A40] bg-[#121018] p-3">
      <p className="text-sm font-black text-[#F9FAFB]">{title}</p>
      <ul className="mt-2 grid gap-1 text-sm leading-6 text-[#C4BFD0]">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
