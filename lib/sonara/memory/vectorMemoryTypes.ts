export type VectorMemoryProvider =
  | "supabase_pgvector"
  | "qdrant"
  | "chroma"
  | "milvus"
  | "weaviate"
  | "faiss_local";

export type SonaraMemoryKind =
  | "project"
  | "prompt"
  | "export"
  | "sound_asset"
  | "release_plan"
  | "authentic_writer_note"
  | "brand_doc"
  | "support_feedback"
  | "store_product"
  | "research_note";

export type SonaraMemoryRecord = {
  id: string;
  userId?: string;
  kind: SonaraMemoryKind;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
  embedding?: number[];
  createdAt?: string;
  updatedAt?: string;
};

export type VectorMemoryStatus = "ready" | "stored_without_embedding" | "not_configured";

export type VectorMemoryResult = {
  status: VectorMemoryStatus;
  record: SonaraMemoryRecord;
  message: string;
};
