"use client";

import { SoundToggle } from "./SoundToggle";
import { VoiceToggle } from "./VoiceToggle";

export function AlertPreferences() {
  return (
    <section aria-live="polite" className="grid gap-3 rounded-2xl border border-white/10 bg-[#081827] p-5">
      <h2 className="text-xl font-black text-white">Alert preferences</h2>
      <p className="text-sm leading-6 text-[#CBD5E1]">
        Sounds and voice announcements are optional, stored locally first, and never autoplay on page load.
      </p>
      <SoundToggle />
      <VoiceToggle />
    </section>
  );
}
