import type { GenreUniverseGuidance } from "../../lib/sonara/genre/genreUniverseTypes";
import { getGenreUniverseGuidance } from "../../lib/sonara/genre/genreUniverseEngine";

export function GenreUniverseCard({ guidance = getGenreUniverseGuidance() }: { guidance?: GenreUniverseGuidance }) {
  return (
    <section className="rounded-lg border border-[#332A40] bg-[#191522] p-4 text-[#F9FAFB]">
      <p className="text-xs font-black uppercase text-[#2DD4BF]">SONARA Core</p>
      <h3 className="mt-2 text-xl font-black">{guidance.label} genre guidance</h3>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <List title="Arrangement" items={guidance.arrangementPriorities} />
        <List title="Rhythm" items={guidance.rhythmLanguage} />
        <List title="Harmony" items={guidance.harmonicLanguage} />
        <List title="Palette" items={guidance.soundPalette} />
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
