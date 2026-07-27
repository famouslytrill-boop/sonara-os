import "server-only";
import { getOpsClient, normalizeSupabaseError, notConfiguredResult } from "./client";
import type { DbHealthSnapshotInput, DbOpsResult, JsonRecord } from "../../types/databaseOps";

export type DbHealthSnapshotRow = {
  id: string;
  check_name: string;
  status: string;
  score: number | null;
  details: JsonRecord;
  created_at: string;
};

export async function recordDbHealthSnapshot(input: DbHealthSnapshotInput): Promise<DbOpsResult<DbHealthSnapshotRow>> {
  const supabase = getOpsClient();

  if (!supabase) {
    return notConfiguredResult();
  }

  const payload = {
    check_name: input.checkName,
    status: input.status,
    score: input.score ?? null,
    details: input.details ?? {},
  };

  const { data, error } = await supabase
    .from("db_health_snapshots")
    .insert<DbHealthSnapshotRow>(payload)
    .select("*")
    .single();

  if (error || !data) {
    return { ok: false, error: normalizeSupabaseError(error) };
  }

  return { ok: true, data };
}
