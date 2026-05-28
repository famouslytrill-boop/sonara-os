"use client";

import { useEffect, useState } from "react";

export function VoiceToggle() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(localStorage.getItem("sonara.voice.enabled") === "true");
  }, []);

  function update(value: boolean) {
    setEnabled(value);
    localStorage.setItem("sonara.voice.enabled", String(value));
  }

  return (
    <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-bold text-white">
      Voice announcements
      <input checked={enabled} onChange={(event) => update(event.target.checked)} type="checkbox" />
    </label>
  );
}
