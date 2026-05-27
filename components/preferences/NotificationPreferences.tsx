"use client";

import { useEffect, useState } from "react";
import {
  defaultNotificationPreferences,
  readNotificationPreferences,
  soundPalette,
  writeNotificationPreferences,
  type NotificationPreferenceState,
} from "../../lib/preferences/notification-preferences";

const preferenceLabels: Array<[keyof NotificationPreferenceState, string, string]> = [
  ["soundEffects", "Sound effects", "Optional short UI sounds. Off by default."],
  ["voiceAnnouncements", "Voice announcements", "Optional spoken confirmations. Off by default."],
  ["haptics", "Haptics", "Device vibration where supported. Off by default."],
  ["visualAlerts", "Visual alerts", "Visible in-app alerts. On by default."],
  ["emailAlerts", "Email alerts", "Placeholder until email provider is configured."],
  ["smsAlerts", "SMS alerts", "Placeholder until SMS provider and consent are configured."],
  ["browserPush", "Browser push", "Placeholder until push setup and permission flow are configured."],
];

export function NotificationPreferences() {
  const [preferences, setPreferences] = useState(defaultNotificationPreferences);

  useEffect(() => {
    setPreferences(readNotificationPreferences());
  }, []);

  function update(key: keyof NotificationPreferenceState) {
    const next = { ...preferences, [key]: !preferences[key] };
    setPreferences(next);
    writeNotificationPreferences(next);
  }

  return (
    <section className="grid gap-5">
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <h2 className="text-xl font-black text-white">Notification preferences</h2>
        <p className="mt-2 text-sm leading-6 text-[#CBD5E1]">
          Sounds, voices, haptics, SMS, email, and push are user-controlled. Audio never plays on page load.
        </p>
      </div>
      <div className="grid gap-3">
        {preferenceLabels.map(([key, label, description]) => (
          <label
            key={key}
            className="flex min-h-16 items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#081827] p-4"
          >
            <span>
              <span className="block text-sm font-black text-white">{label}</span>
              <span className="mt-1 block text-sm text-[#CBD5E1]">{description}</span>
            </span>
            <input
              aria-label={label}
              checked={preferences[key]}
              className="h-6 w-6 accent-[#2DD4BF]"
              onChange={() => update(key)}
              type="checkbox"
            />
          </label>
        ))}
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <h2 className="text-lg font-black text-white">Sound palette</h2>
        <p className="mt-2 text-sm leading-6 text-[#CBD5E1]">
          These labels reserve a calm sound system for later implementation:
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {soundPalette.map((sound) => (
            <span key={sound} className="rounded-full border border-white/10 px-3 py-2 text-xs font-bold text-[#CBD5E1]">
              {sound}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
