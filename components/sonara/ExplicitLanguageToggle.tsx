"use client";

import type { LyricExplicitnessMode } from "../../lib/sonara/writing/explicitLanguagePolicy";

const modes: LyricExplicitnessMode[] = ["clean", "radio_safe", "mature", "explicit"];

export function ExplicitLanguageToggle({
  value,
  onChange,
}: {
  value: LyricExplicitnessMode;
  onChange: (mode: LyricExplicitnessMode) => void;
}) {
  return (
    <fieldset className="rounded-lg border border-[#332A40] bg-[#191522] p-4 text-[#F9FAFB]">
      <legend className="px-1 text-sm font-black">Explicitness mode</legend>
      <p className="mt-1 text-sm text-[#C4BFD0]">Controls language intensity for lyrics and writing exports.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        {modes.map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onChange(mode)}
            aria-pressed={value === mode}
            className={`min-h-11 rounded-lg border px-3 text-sm font-bold capitalize ${
              value === mode ? "border-[#FFB454] bg-[#211B2D] text-[#F9FAFB]" : "border-[#332A40] bg-[#121018] text-[#C4BFD0]"
            }`}
          >
            {mode.replace("_", " ")}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
