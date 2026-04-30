import { hasEmbeddingConfig } from "./vectorProvider";
import type { SonaraMemoryRecord, VectorMemoryResult } from "./vectorMemoryTypes";

export function createMemoryRecord(input: Omit<SonaraMemoryRecord, "id" | "createdAt" | "updatedAt"> & { id?: string }): SonaraMemoryRecord {
  const now = new Date().toISOString();
  return {
    id: input.id ?? `mem_${Math.abs(hashText(`${input.kind}:${input.title}:${input.content}`))}`,
    userId: input.userId,
    kind: input.kind,
    title: input.title,
    content: input.content,
    metadata: input.metadata ?? {},
    embedding: input.embedding,
    createdAt: now,
    updatedAt: now,
  };
}

export function prepareMemoryForStorage(record: SonaraMemoryRecord): VectorMemoryResult {
  if (!record.embedding?.length) {
    return {
      status: hasEmbeddingConfig() ? "stored_without_embedding" : "not_configured",
      record,
      message: "Memory text and metadata can be stored now. Semantic embedding search is optional and not configured.",
    };
  }

  return {
    status: "ready",
    record,
    message: "Memory record includes an embedding and is ready for semantic search storage.",
  };
}

export function searchMemoryFallback(records: SonaraMemoryRecord[], query: string) {
  const normalizedQuery = query.toLowerCase();
  return records.filter((record) => `${record.title} ${record.content}`.toLowerCase().includes(normalizedQuery));
}

function hashText(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return hash;
}
