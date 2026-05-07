"use client";

import { GitCompare, RotateCcw, Save } from "lucide-react";

export function RegenerationControls({ disabled = true }: { disabled?: boolean }) {
  const buttons = [
    { label: "Regenerate same data", icon: RotateCcw },
    { label: "Regenerate with changes", icon: RotateCcw },
    { label: "Restore previous", icon: Save },
    { label: "Compare versions", icon: GitCompare },
    { label: "Mark selected", icon: Save },
  ];

  return (
    <section className="rounded-lg border border-[#332A40] bg-[#191522] p-4 text-[#F9FAFB]">
      <p className="text-xs font-black uppercase text-[#2DD4BF]">Generation History</p>
      <h3 className="mt-2 text-xl font-black">Restore and regeneration controls</h3>
      <p className="mt-2 text-sm leading-6 text-[#C4BFD0]">
        Persistent history is optional through Supabase. These controls are safe placeholders until project history is wired to the active user.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {buttons.map(({ icon: Icon, label }) => (
          <button
            key={label}
            type="button"
            disabled={disabled}
            aria-disabled={disabled}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#332A40] bg-[#121018] px-3 text-sm font-bold text-[#F9FAFB] disabled:opacity-50"
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}
