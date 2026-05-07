import "server-only";
import { getOpsClient, normalizeSupabaseError, notConfiguredResult } from "./client";
import type { DbOpsResult, JsonRecord, SystemAuditEventInput } from "../../types/databaseOps";

export type SystemAuditEventRow = {
  id: string;
  event_type: string;
  source: string;
  actor_id: string | null;
  actor_email: string | null;
  entity_type: string | null;
  entity_id: string | null;
  severity: string;
  message: string;
  metadata: JsonRecord;
  created_at: string;
};

export async function recordAuditEvent(input: SystemAuditEventInput): Promise<DbOpsResult<SystemAuditEventRow>> {
  const supabase = getOpsClient();

  if (!supabase) {
    return notConfiguredResult();
  }

  const payload = {
    event_type: input.eventType,
    source: input.source,
    actor_id: input.actorId ?? null,
    actor_email: input.actorEmail ?? null,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    severity: input.severity ?? "info",
    message: input.message,
    metadata: input.metadata ?? {},
  };

  const { data, error } = await supabase
    .from("system_audit_events")
    .insert<SystemAuditEventRow>(payload)
    .select("*")
    .single();

  if (error || !data) {
    return { ok: false, error: normalizeSupabaseError(error) };
  }

  return { ok: true, data };
}
