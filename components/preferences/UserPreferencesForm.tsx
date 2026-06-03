"use client";

import { useActionState, useEffect, useState } from "react";
import type { UserPreferences } from "../../lib/preferences/user-preferences";
import { defaultUserPreferences, supportedLanguages, supportedUnitSystems } from "../../lib/preferences/user-preferences";
import { saveUserPreferencesAction, type PreferencesActionState } from "../../app/app/settings/actions";
import { Button } from "../ui/Button";

const initialState: PreferencesActionState = { ok: false, message: "" };

export function UserPreferencesForm({
  initialPreferences = defaultUserPreferences,
  signedIn,
}: {
  initialPreferences?: UserPreferences;
  signedIn: boolean;
}) {
  const [language, setLanguage] = useState(initialPreferences.language);
  const [unitSystem, setUnitSystem] = useState(initialPreferences.unitSystem);
  const [state, formAction, pending] = useActionState(saveUserPreferencesAction, initialState);

  useEffect(() => {
    if (!signedIn) {
      const saved = window.localStorage.getItem("sonara_guest_preferences");
      if (!saved) return;

      try {
        const parsed = JSON.parse(saved) as Partial<UserPreferences>;
        if (parsed.language) setLanguage(parsed.language);
        if (parsed.unitSystem) setUnitSystem(parsed.unitSystem);
      } catch {
        window.localStorage.removeItem("sonara_guest_preferences");
      }
    }
  }, [signedIn]);

  useEffect(() => {
    if (!signedIn) {
      window.localStorage.setItem("sonara_guest_preferences", JSON.stringify({ language, unitSystem }));
    }
  }, [language, signedIn, unitSystem]);

  return (
    <form action={formAction} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-white">Language and units</p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#CBD5E1]">
            Brand names and legal/pricing/security language remain in English until human-reviewed translations are approved.
          </p>
        </div>
        <span className="rounded-full border border-[#2DD4BF]/35 bg-[#2DD4BF]/10 px-3 py-1 text-xs font-black uppercase text-[#99F6E4]">
          {signedIn ? "Account saved" : "Guest fallback"}
        </span>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold text-white">
          Language
          <select
            className="min-h-11 rounded-lg border border-white/10 bg-[#07111F] px-3 text-white"
            name="language"
            value={language}
            onChange={(event) => setLanguage(event.target.value as UserPreferences["language"])}
          >
            {supportedLanguages.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
                {option.reviewRequired ? " - human review required" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm font-bold text-white">
          Unit system
          <select
            className="min-h-11 rounded-lg border border-white/10 bg-[#07111F] px-3 text-white"
            name="unitSystem"
            value={unitSystem}
            onChange={(event) => setUnitSystem(event.target.value as UserPreferences["unitSystem"])}
          >
            {supportedUnitSystems.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button>{pending ? "Saving..." : "Save preferences"}</Button>
        {state.message ? (
          <p className={`text-sm ${state.ok ? "text-[#99F6E4]" : "text-[#FCA5A5]"}`}>{state.message}</p>
        ) : null}
      </div>
    </form>
  );
}
