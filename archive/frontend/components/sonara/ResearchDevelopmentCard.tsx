import { FlaskConical } from "lucide-react";
import { sonaraResearchRoadmap } from "../../lib/sonara/research/researchRoadmap";

export function ResearchDevelopmentCard() {
  return (
    <section className="mt-6 rounded-lg border border-[#2A2A35] bg-[#171720] p-5 text-[#F8FAFC]">
      <div className="flex items-center gap-3">
        <FlaskConical className="text-[#22D3EE]" size={24} />
        <div>
          <p className="text-xs font-black uppercase text-[#22D3EE]">Research & Development</p>
          <h2 className="mt-1 text-2xl font-black">What belongs now vs later.</h2>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <RoadmapColumn title="Now" items={sonaraResearchRoadmap.now} />
        <RoadmapColumn title="Later" items={sonaraResearchRoadmap.later} />
      </div>
    </section>
  );
}

function RoadmapColumn({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-[#2A2A35] bg-[#111118] p-4">
      <p className="font-black text-[#F8FAFC]">{title}</p>
      <ul className="mt-3 grid gap-2 text-sm leading-6 text-[#A1A1AA]">
        {items.map((item) => (
          <li key={item}>- {item}</li>
        ))}
      </ul>
    </div>
  );
}
