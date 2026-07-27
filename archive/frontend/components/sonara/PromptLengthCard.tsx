import type { PromptDetailLevel } from "../../lib/sonara/prompts/promptLengthTypes";

export function PromptLengthCard({ detailLevel }: { detailLevel: PromptDetailLevel }) {
  return (
    <section className="rounded-lg border border-[#2A2A35] bg-[#171720] p-5 text-[#F8FAFC]">
      <p className="text-xs font-black uppercase text-[#22D3EE]">Prompt Length</p>
      <h2 className="mt-2 text-xl font-black">{detailLevel.mode.toUpperCase()} Prompt Mode</h2>
      <p className="mt-2 text-sm leading-6 text-[#A1A1AA]">
        Recommended detail level for this project situation.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <PromptLengthValue label="Minimum" value={detailLevel.targetMinCharacters} />
        <PromptLengthValue label="Ideal" value={detailLevel.targetIdealCharacters} accent />
        <PromptLengthValue label="Maximum" value={detailLevel.targetMaxCharacters} warning />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <PromptLengthList title="Allowed Sections" items={detailLevel.allowedSections} />
        <PromptLengthList title="Notes" items={detailLevel.notes} />
      </div>
    </section>
  );
}

function PromptLengthValue({
  label,
  value,
  accent = false,
  warning = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
  warning?: boolean;
}) {
  const colorClass = accent ? "text-[#22D3EE]" : warning ? "text-[#F59E0B]" : "text-[#F8FAFC]";

  return (
    <div className="rounded-lg border border-[#2A2A35] bg-[#111118] p-4">
      <p className="text-xs font-bold uppercase text-[#71717A]">{label}</p>
      <p className={`mt-1 text-xl font-black ${colorClass}`}>{value}</p>
    </div>
  );
}

function PromptLengthList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-[#F8FAFC]">{title}</h3>
      <ul className="mt-2 grid gap-1 text-sm leading-6 text-[#A1A1AA]">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
