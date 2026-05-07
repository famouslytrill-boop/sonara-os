import "server-only";
import { getOpsClient, normalizeSupabaseError, notConfiguredResult } from "./client";
import type { CreatorActivityInput, DbOpsResult, JsonRecord } from "../../types/databaseOps";

export type CreatorActivityEventRow = {
  id: string;
  user_id: string | null;
  session_id: string | null;
  event_name: string;
  route: string | null;
  product_area: string | null;
  metadata: JsonRecord;
  created_at: string;
};

export async function recordCreatorActivity(input: CreatorActivityInput): Promise<DbOpsResult<CreatorActivityEventRow>> {
  const supabase = getOpsClient();

  if (!supabase) {
    return notConfiguredResult();
  }

  const payload = {
    user_id: input.userId ?? null,
    session_id: input.sessionId ?? null,
    event_name: input.eventName,
    route: input.route ?? null,
    product_area: input.productArea ?? null,
    metadata: input.metadata ?? {},
  };

  const { data, error } = await supabase
    .from("creator_activity_events")
    .insert<CreatorActivityEventRow>(payload)
    .select("*")
    .single();

  if (error || !data) {
    return { ok: false, error: normalizeSupabaseError(error) };
  }

  return { ok: true, data };
}
