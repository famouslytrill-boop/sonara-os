import { annotateLyrics } from "../../lib/sonara/lyrics/lyricAnnotationEngine";
import type { LyricAnnotation } from "../../lib/sonara/lyrics/lyricAnnotationTypes";

export function LyricAnnotationCard({ annotations = annotateLyrics("") }: { annotations?: LyricAnnotation[] }) {
  return (
    <section className="rounded-lg border border-[#332A40] bg-[#191522] p-4 text-[#F9FAFB]">
      <p className="text-xs font-black uppercase text-[#F472B6]">Lyric Annotation</p>
      <h3 className="mt-2 text-xl font-black">Line-level performance notes</h3>
      <ul className="mt-3 grid gap-2 text-sm leading-6 text-[#C4BFD0]">
        {(annotations.length ? annotations : [{ line: "Paste lyrics to annotate.", purpose: "input needed", performanceNote: "no annotation yet", rightsNote: "no export until user text exists" }]).map((annotation) => (
          <li key={`${annotation.line}-${annotation.purpose}`} className="rounded-lg border border-[#332A40] bg-[#121018] p-3">
            <span className="font-bold text-[#F9FAFB]">{annotation.line}</span>
            <br />
            {annotation.performanceNote}
          </li>
        ))}
      </ul>
    </section>
  );
}
