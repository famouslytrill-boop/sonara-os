import type { ReleaseAnalysis } from "../../sonara-core";
import { getSupabaseBrowserClient } from "../../supabase";

export type SavedSonaraProject = {
  id: string;
  title: string;
  creator_name: string | null;
  notes: string;
  fingerprint_id: string;
  readiness_score: number;
  launch_state: string;
  analysis: ReleaseAnalysis;
  created_at: string;
  updated_at: string;
};

export async function saveSonaraProject(input: {
  title: string;
  creatorName?: string;
  notes: string;
  analysis: ReleaseAnalysis;
}) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Sign in to save this SONARA project.");
  }

  const { data, error } = await supabase
    .from("sonara_projects")
    .insert({
      owner_id: user.id,
      title: input.title,
      creator_name: input.creatorName ?? null,
      notes: input.notes,
      fingerprint_id: input.analysis.fingerprint.id,
      readiness_score: input.analysis.readiness.score,
      launch_state: input.analysis.readiness.launchState,
      analysis: input.analysis,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as SavedSonaraProject;
}

export async function listSonaraProjects() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return [];
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from("sonara_projects")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as SavedSonaraProject[];
}

export async function deleteSonaraProject(projectId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { error } = await supabase.from("sonara_projects").delete().eq("id", projectId);

  if (error) {
    throw new Error(error.message);
  }
}
