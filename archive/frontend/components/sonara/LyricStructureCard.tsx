import type { LyricStructureResult } from "../../lib/sonara/writing/lyricStructureTypes";
import { analyzeLyricStructure } from "../../lib/sonara/writing/lyricStructureEngine";

export function LyricStructureCard({ result = analyzeLyricStructure({ rawLyrics: "" }) }: { result?: LyricStructureResult }) {
  return (
    <section className="rounded-lg border border-[#332A40] bg-[#191522] p-4 text-[#F9FAFB]">
      <p className="text-xs font-black uppercase text-[#F472B6]">Lyric Structure Engine</p>
      <h3 className="mt-2 text-xl font-black">{result.suggestedStructure}</h3>
      <p className="mt-2 text-sm leading-6 text-[#C4BFD0]">{result.structureReason}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <List title="Hook candidates" items={result.hookCandidates.length ? result.hookCandidates : ["Add more user-written lines to extract a hook."]} />
        <List title="Missing pieces" items={result.missingPieces.length ? result.missingPieces : ["No critical lyric structure gaps found."]} />
        <List title="Breath markers" items={result.breathMarkers.slice(0, 4)} />
        <List title="Warnings" items={result.warnings.length ? result.warnings : ["Explicitness mode is labeled for export."]} />
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
