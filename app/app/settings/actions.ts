"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { parseLanguage, parseUnitSystem } from "../../../lib/preferences/user-preferences";

export type PreferencesActionState = {
  ok: boolean;
  message: string;
};

export async function saveUserPreferencesAction(_previousState: PreferencesActionState, formData: FormData): Promise<PreferencesActionState> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return {
      ok: false,
      message: "Supabase is not configured. Signed-in preferences cannot be saved until public auth env vars are present.",
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      message: "Sign in before saving preferences to your SONARA workspace.",
    };
  }

  const language = parseLanguage(formData.get("language"));
  const unitSystem = parseUnitSystem(formData.get("unitSystem"));

  const { error } = await supabase.from("user_preferences").upsert(
    {
      user_id: user.id,
      language,
      unit_system: unitSystem,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return {
      ok: false,
      message: "Preferences could not be saved. Confirm the user_preferences migration is applied and RLS is enabled.",
    };
  }

  revalidatePath("/app/settings");
  revalidatePath("/app/dashboard");

  return {
    ok: true,
    message: "Preferences saved to your SONARA account.",
  };
}
