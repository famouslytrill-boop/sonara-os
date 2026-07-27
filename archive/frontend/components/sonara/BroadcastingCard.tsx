import { Radio } from "lucide-react";
import type { BroadcastKit } from "../../lib/sonara/broadcast/broadcastKit";

export function BroadcastingCard({ kit }: { kit: BroadcastKit }) {
  return (
    <article className="rounded-lg border border-[#2A2A35] bg-[#111118] p-4 text-[#F8FAFC]">
      <div className="flex items-center gap-3">
        <Radio className="text-[#22D3EE]" size={22} />
        <div>
          <p className="text-xs font-black uppercase text-[#22D3EE]">OBS-ready broadcast kit</p>
          <h2 className="mt-1 text-xl font-black">{kit.streamTitle}</h2>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <InfoBlock title="Scenes" items={kit.sceneList} />
        <InfoBlock title="Audio" items={kit.audioRoutingNotes} />
        <InfoBlock title="Premiere" items={kit.livePremiereChecklist} />
      </div>

      <p className="mt-4 text-sm leading-6 text-[#A1A1AA]">
        This is a practical broadcast-plan export for OBS Studio workflows. Direct OBS control can be added later through WebSocket integration.
      </p>
    </article>
  );
}

function InfoBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-[#2A2A35] bg-[#171720] p-3">
      <p className="text-sm font-black text-[#F8FAFC]">{title}</p>
      <ul className="mt-2 grid gap-2 text-sm leading-6 text-[#A1A1AA]">
        {items.slice(0, 4).map((item) => (
          <li key={item}>- {item}</li>
        ))}
      </ul>
    </div>
  );
}
