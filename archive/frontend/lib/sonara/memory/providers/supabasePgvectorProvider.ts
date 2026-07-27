import { getSupabaseAdminClient } from "../../../supabaseAdmin";
import { prepareMemoryForStorage } from "../vectorMemoryEngine";
import type { SonaraMemoryRecord } from "../vectorMemoryTypes";

export async function storeSupabasePgvectorMemory(record: SonaraMemoryRecord) {
  const prepared = prepareMemoryForStorage(record);
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return {
      ...prepared,
      status: "not_configured" as const,
      message: "Supabase service role is not configured. Memory record was prepared but not stored.",
    };
  }

  const { error } = await supabase.from("sonara_memory_records").upsert({
    id: prepared.record.id,
    user_id: prepared.record.userId ?? null,
    kind: prepared.record.kind,
    title: prepared.record.title,
    content: prepared.record.content,
    metadata: prepared.record.metadata ?? {},
    embedding: prepared.record.embedding ?? null,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw error;
  }

  return prepared;
}
