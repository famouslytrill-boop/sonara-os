"use client";

import type { SliderProfile } from "../../lib/sonara/generation/sliderRecommendations";

type DisplaySliderProfile = Omit<SliderProfile, "audioInfluence"> & {
  audioInfluence?: number | null;
};

export function SliderRecommendationCard({ profile }: { profile: DisplaySliderProfile }) {
  const audioInfluence = profile.audioInfluence ?? null;

  return (
    <section className="rounded-lg border border-[#2A2A35] bg-[#171720] p-5 text-[#F8FAFC]">
      <p className="text-xs font-black uppercase text-[#22D3EE]">External Generator Settings</p>
      <h2 className="mt-2 text-xl font-black">Style + Weirdness Suggestions</h2>
      <p className="mt-2 text-sm leading-6 text-[#A1A1AA]">
        Suggested creative-control settings for Suno-style and similar music tools. These are guidance only, not guaranteed results.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <SliderValue label="Weirdness" value={`${profile.weirdness}%`} />
        <SliderValue label="Style Influence" value={`${profile.styleInfluence}%`} />
        <SliderValue label="Audio Influence" value={audioInfluence === null ? "N/A" : `${audioInfluence}%`} />
        <SliderValue label="Auto Influence" value={profile.autoInfluence} />
      </div>

      <ul className="mt-5 grid gap-2 text-sm leading-6 text-[#A1A1AA]">
        {profile.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </section>
  );
}

function SliderValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#2A2A35] bg-[#111118] p-4">
      <p className="text-xs font-bold uppercase text-[#71717A]">{label}</p>
      <p className="mt-1 text-2xl font-black capitalize text-[#F8FAFC]">{value}</p>
    </div>
  );
}
