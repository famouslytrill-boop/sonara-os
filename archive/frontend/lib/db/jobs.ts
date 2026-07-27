import "server-only";
import { getOpsClient, normalizeSupabaseError, notConfiguredResult } from "./client";
import type { DbOpsResult, PlatformJobInput, PlatformJobRow, PlatformJobUpdate } from "../../types/databaseOps";

export async function createPlatformJob(input: PlatformJobInput): Promise<DbOpsResult<PlatformJobRow>> {
  const supabase = getOpsClient();

  if (!supabase) {
    return notConfiguredResult();
  }

  const payload = {
    job_type: input.jobType,
    status: input.status ?? "queued",
    priority: input.priority ?? 5,
    input: input.input ?? {},
  };

  const { data, error } = await supabase
    .from("platform_jobs")
    .insert<PlatformJobRow>(payload)
    .select("*")
    .single();

  if (error || !data) {
    return { ok: false, error: normalizeSupabaseError(error) };
  }

  return { ok: true, data };
}

export async function updatePlatformJob(jobId: string, update: PlatformJobUpdate): Promise<DbOpsResult<PlatformJobRow>> {
  const supabase = getOpsClient();

  if (!supabase) {
    return notConfiguredResult();
  }

  const payload = {
    status: update.status,
    output: update.output,
    error: update.error,
    started_at: update.startedAt,
    completed_at: update.completedAt,
  };

  const { data, error } = await supabase
    .from("platform_jobs")
    .update<PlatformJobRow>(Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined)))
    .eq("id", jobId)
    .select("*")
    .single();

  if (error || !data) {
    return { ok: false, error: normalizeSupabaseError(error) };
  }

  return { ok: true, data };
}
