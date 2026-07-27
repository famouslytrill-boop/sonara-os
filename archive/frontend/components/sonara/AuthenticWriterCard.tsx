import { PenLine } from "lucide-react";
import type { AuthenticWriterGuidance } from "../../lib/sonara/writing/authenticWriterTypes";

export function AuthenticWriterCard({ guidance }: { guidance: AuthenticWriterGuidance }) {
  return (
    <article className="rounded-lg border border-[#332A40] bg-[#191522] p-4 text-[#F9FAFB]">
      <div className="flex items-center gap-3">
        <PenLine className="text-[#F472B6]" size={22} />
        <div>
          <p className="text-xs font-black uppercase text-[#FFB454]">Authentic Writer Engine</p>
          <h2 className="text-xl font-black">{guidance.authenticityScore}/100 authenticity signal</h2>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <ListBlock title="Add details" items={guidance.requiredDetails.slice(0, 5)} empty="Core details are present." />
        <ListBlock title="Reporting questions" items={guidance.reportingQuestions.slice(0, 3)} />
      </div>
      <ListBlock title="Revision checklist" items={guidance.revisionChecklist.slice(0, 5)} />
    </article>
  );
}

function ListBlock({ empty, items, title }: { empty?: string; items: string[]; title: string }) {
  return (
    <div className="mt-3 rounded-lg border border-[#332A40] bg-[#121018] p-3">
      <p className="text-sm font-black text-[#F9FAFB]">{title}</p>
      <ul className="mt-2 grid gap-1 text-sm leading-6 text-[#C4BFD0]">
        {items.length ? items.map((item) => <li key={item}>- {item}</li>) : <li>{empty ?? "No follow-up needed."}</li>}
      </ul>
    </div>
  );
}
