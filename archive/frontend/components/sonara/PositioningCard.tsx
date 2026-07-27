import { Compass } from "lucide-react";
import { getSonaraPositioning } from "../../lib/sonara/marketing/positioningEngine";

export function PositioningCard() {
  const positioning = getSonaraPositioning();

  return (
    <article className="rounded-lg border border-[#332A40] bg-[#191522] p-4 text-[#F9FAFB]">
      <Compass className="text-[#2DD4BF]" size={22} />
      <p className="mt-3 text-xs font-black uppercase text-[#FFB454]">Positioning</p>
      <h2 className="mt-1 text-xl font-black">{positioning.promise}</h2>
      <ul className="mt-3 grid gap-2 text-sm leading-6 text-[#C4BFD0]">
        {positioning.proofPoints.map((point) => (
          <li key={point}>- {point}</li>
        ))}
      </ul>
    </article>
  );
}
