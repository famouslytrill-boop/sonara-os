import { UserPreferencesForm } from "../../../components/preferences/UserPreferencesForm";
import { ensureUserWorkspace } from "../../../lib/auth/workspace";
import { defaultUserPreferences, type UserPreferences } from "../../../lib/preferences/user-preferences";
import { getSupabaseAdminClient } from "../../../lib/supabase/admin";
import { AppDashboardShell } from "../../../components/AppDashboardShell";

async function getInitialPreferences(userId: string): Promise<UserPreferences> {
  const admin = getSupabaseAdminClient();
  if (!admin) return defaultUserPreferences;

  const { data } = await admin
    .from("user_preferences")
    .select("language, unit_system")
    .eq("user_id", userId)
    .maybeSingle();

  return {
    language: (data?.language as UserPreferences["language"] | undefined) ?? defaultUserPreferences.language,
    unitSystem: (data?.unit_system as UserPreferences["unitSystem"] | undefined) ?? defaultUserPreferences.unitSystem,
  };
}

export default async function AppSettingsPage() {
  const workspace = await ensureUserWorkspace();
  const preferences = workspace.user ? await getInitialPreferences(workspace.user.id) : defaultUserPreferences;

  return (
    <AppDashboardShell title="Settings">
      <section className="grid gap-4">
        <UserPreferencesForm initialPreferences={preferences} signedIn={Boolean(workspace.user)} />

        <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-sm font-black text-white">Account state</p>
          <p className="mt-2 text-sm leading-6 text-[#CBD5E1]">
            Status: {workspace.status}. {workspace.status === "ready" ? `Role: ${workspace.role}.` : "Complete auth and workspace setup before production use."}
          </p>
        </article>
      </section>
    </AppDashboardShell>
  );
}
